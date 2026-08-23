import type { Rule } from '@agent-engine/config';
import { buildSystemPrompt } from '../context/build-system-prompt';
import type { HookPipeline } from '../hooks/pipeline';
import type { ChatCompletionResult, ChatMessage, LLMProvider } from '../llm/types';
import type { ConversationMemory } from '../memory/conversation-memory';
import { loadRulesText } from '../rules/load';
import type { RuleRegistry } from '../rules/registry';
import { CapabilityLoader } from '../retrieval/loader';
import type { Skill } from '../skills/types';
import type { ToolRegistry } from '../tools/registry';
import type { AgentLoopOptions, AgentLoopResult, SystemPromptInput } from './types';

/** 单 Agent ReAct 执行循环。 */
export class AgentLoop {
  private readonly provider: LLMProvider;
  private readonly registry: ToolRegistry;
  private readonly systemPrompt: SystemPromptInput;
  private readonly maxSteps: number;
  private readonly hooks: HookPipeline | undefined;
  private readonly guardrails: RuleRegistry | undefined;
  private readonly rules: Rule[];
  private readonly ruleLoader: CapabilityLoader<Rule> | undefined;
  private readonly skillLoader: CapabilityLoader<Skill> | undefined;
  private readonly memory: ConversationMemory | undefined;

  constructor(options: AgentLoopOptions) {
    this.provider = options.provider;
    this.registry = options.registry;
    this.systemPrompt = options.systemPrompt;
    this.maxSteps = options.maxSteps ?? 10;
    this.hooks = options.hooks;
    this.guardrails = options.guardrails;
    this.rules = options.rules ?? [];
    this.ruleLoader =
      this.rules.length > 0 ? new CapabilityLoader<Rule>('rule', this.rules) : undefined;
    this.skillLoader =
      options.skills && options.skills.length > 0
        ? new CapabilityLoader<Skill>('skill', options.skills)
        : undefined;
    this.memory = options.memory;
  }

  async run(userInput: string): Promise<AgentLoopResult> {
    // 检索 rules（always + on-demand）与 skills（on-demand）。
    const rulesText = this.ruleLoader ? loadRulesText(this.rules, this.ruleLoader, userInput) : '';
    const skillHits = this.skillLoader?.loadForQuery(userInput) ?? [];
    for (const hit of skillHits) {
      for (const tool of hit.record.tools ?? []) {
        this.registry.register(tool);
      }
    }
    const skillsText = skillHits
      .map((hit) => `## ${hit.record.id}\n${hit.record.instruction}`)
      .join('\n\n');

    const systemPrompt = await this.resolveSystemPrompt(userInput, rulesText, skillsText);
    const history = this.memory?.getMessages() ?? [];
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userInput },
    ];
    // 本轮新增消息的起始索引（system + 历史之后），正常结束时回写 memory。
    const sessionStart = 1 + history.length;

    let finalMessage: ChatMessage = { role: 'assistant', content: '' };
    let steps = 0;

    try {
      while (steps < this.maxSteps) {
        steps += 1;

        // beforeLLM 改写的是「本次调用入参」，内部 messages 保持真实历史。
        const llmMessages = await this.hooks?.beforeLLM(messages);

        const tools = this.registry.toToolDefinitions();
        let result: ChatCompletionResult = await this.provider.chatCompletion({
          messages: llmMessages ?? messages,
          ...(tools.length > 0 ? { tools } : {}),
        });

        result = (await this.hooks?.afterLLM(result)) ?? result;

        const assistantMessage = result.message;
        messages.push(assistantMessage);
        finalMessage = assistantMessage;

        const toolCalls = assistantMessage.toolCalls ?? [];
        if (toolCalls.length === 0) {
          await this.hooks?.onStepEnd(steps);
          break;
        }

        for (const toolCall of toolCalls) {
          const name = toolCall.function.name;
          const args =
            (await this.hooks?.beforeToolCall(name, toolCall.function.arguments)) ??
            toolCall.function.arguments;

          // guardrail beforeToolCall：校验入参，阻断则不执行工具。
          let toolResult: string;
          const beforeRules = this.guardrails?.forPoint('beforeToolCall') ?? [];
          let blocked = false;
          let blockedReason: string | undefined;
          for (const rule of beforeRules) {
            const verdict = await rule.validate({ toolName: name, args });
            if (!verdict.allowed) {
              blocked = true;
              blockedReason = verdict.reason;
              break;
            }
          }

          if (blocked) {
            toolResult = `Blocked: ${blockedReason ?? 'guardrail denied'}`;
          } else {
            try {
              const output = await this.registry.execute(name, args);
              toolResult = JSON.stringify(output);
            } catch (error) {
              toolResult = `Error: ${error instanceof Error ? error.message : String(error)}`;
            }
          }

          // guardrail afterToolCall：校验结果，阻断则替换结果。
          const afterRules = this.guardrails?.forPoint('afterToolCall') ?? [];
          for (const rule of afterRules) {
            const verdict = await rule.validate({ toolName: name, result: toolResult });
            if (!verdict.allowed) {
              toolResult = `Blocked: ${verdict.reason ?? 'guardrail denied'}`;
              break;
            }
          }

          // hooks.afterToolCall：观察 / 改写最终结果。
          toolResult = (await this.hooks?.afterToolCall(name, toolResult)) ?? toolResult;

          messages.push({
            role: 'tool',
            content: toolResult,
            toolCallId: toolCall.id,
            name,
          });
        }

        await this.hooks?.onStepEnd(steps);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      try {
        await this.hooks?.onError(err, 'agent-loop');
      } catch {
        // onError 钩子自身错误忽略，保留原错误。
      }
      throw err;
    }

    // 正常结束（自然终止 / maxSteps 兜底）时，把本轮消息（system 之外）写回会话记忆。
    // 异常路径（catch 内 throw）不会执行到这里，故不回写，保持历史不变。
    this.memory?.append(messages.slice(sessionStart));

    return { finalMessage, messages, steps };
  }

  /** 解析本次 system prompt：函数式动态生成 / 静态字符串原样返回 / 模板对象自动检索组装。 */
  private async resolveSystemPrompt(
    userInput: string,
    rulesText: string,
    skillsText: string,
  ): Promise<string> {
    if (typeof this.systemPrompt === 'function') {
      return this.systemPrompt(userInput);
    }
    if (typeof this.systemPrompt === 'string') {
      return this.systemPrompt;
    }
    // SystemPrompt 模板对象：渲染变量 + 注入 rules / skills 文本。
    return buildSystemPrompt({ systemPrompt: this.systemPrompt, rulesText, skillsText });
  }
}
