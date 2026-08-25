import type { Rule } from '@agent-engine/config';
import { buildSystemPrompt } from '../context/build-system-prompt';
import type { EventBus } from '../events/event-bus';
import type { HookPipeline } from '../hooks/pipeline';
import {
  AbortError,
  type ChatCompletionResult,
  type ChatMessage,
  type LLMProvider,
  type ToolCall,
} from '../llm/types';
import type { ConversationMemory } from '../memory/conversation-memory';
import type { LongTermMemory } from '../memory/long-term-memory';
import { loadRulesText } from '../rules/load';
import type { RuleRegistry } from '../rules/registry';
import { CapabilityLoader } from '../retrieval/loader';
import type { Skill } from '../skills/types';
import { normalizeToolArgs } from '../tools/registry';
import type { ToolRegistry } from '../tools/registry';
import type { Tool } from '../tools/types';
import type {
  AgentLoopOptions,
  AgentLoopResult,
  AgentRunEvent,
  AgentRunOptions,
  SystemPromptInput,
  ToolApproval,
} from './types';

/** 指数退避睡眠（毫秒）。 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 单 Agent ReAct 执行循环。 */
export class AgentLoop {
  private readonly provider: LLMProvider;
  private readonly registry: ToolRegistry;
  private readonly systemPrompt: SystemPromptInput;
  private readonly maxSteps: number;
  private readonly maxToolCalls: number | undefined;
  private readonly timeoutMs: number | undefined;
  private readonly toolRetry: { maxRetries: number; baseDelayMs: number };
  private readonly maxContinuations: number;
  private readonly hooks: HookPipeline | undefined;
  private readonly guardrails: RuleRegistry | undefined;
  private readonly rules: Rule[];
  private readonly ruleLoader: CapabilityLoader<Rule> | undefined;
  private readonly skillLoader: CapabilityLoader<Skill> | undefined;
  private readonly memory: ConversationMemory | undefined;
  private readonly longTermMemory: LongTermMemory | undefined;
  private readonly eventBus: EventBus | undefined;
  private sessionStarted = false;
  private sessionEnded = false;

  constructor(options: AgentLoopOptions) {
    this.provider = options.provider;
    this.registry = options.registry;
    this.systemPrompt = options.systemPrompt;
    this.maxSteps = options.execution?.maxSteps ?? options.maxSteps ?? 10;
    this.maxToolCalls = options.execution?.maxToolCalls;
    this.timeoutMs = options.execution?.timeoutMs;
    this.toolRetry = {
      maxRetries: options.execution?.toolRetry?.maxRetries ?? 0,
      baseDelayMs: options.execution?.toolRetry?.baseDelayMs ?? 500,
    };
    this.maxContinuations = options.execution?.maxContinuations ?? 1;
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
    this.longTermMemory = options.longTermMemory;
    this.eventBus = options.eventBus;
  }

  async run(userInput: string, options?: AgentRunOptions): Promise<AgentLoopResult> {
    const emit = options?.onEvent;
    const signal = options?.signal;
    // 转发 hook trace 到事件流（可观测：哪一步做了什么、是否改写、耗时）。
    const offTrace = this.hooks?.onTrace((trace) => emit?.({ type: 'hook', trace }));
    // 转发事件总线 custom 事件到事件流（用户/插件自定义事件）。
    const offCustom = this.eventBus?.on((event) => {
      if (event.type === 'custom') {
        emit?.({ type: 'custom', name: event.name, data: event.data });
      }
    });
    // 入口即检查取消信号。
    if (signal?.aborted) {
      offTrace?.();
      offCustom?.();
      throw new AbortError();
    }

    // 检索 rules（always + on-demand）与 skills（on-demand）。
    const rulesText = this.ruleLoader ? loadRulesText(this.rules, this.ruleLoader, userInput) : '';
    const skillHits = this.skillLoader?.loadForQuery(userInput) ?? [];
    // 记录本轮注册的 skill 工具（含覆盖前的同名工具），run 结束（含异常）时还原/移除，避免跨 run 残留。
    const registeredSkillTools: { name: string; prior: Tool | undefined }[] = [];
    for (const hit of skillHits) {
      for (const tool of hit.record.tools ?? []) {
        registeredSkillTools.push({ name: tool.name, prior: this.registry.get(tool.name) });
        this.registry.register(tool);
      }
    }
    const skillsText = skillHits
      .map((hit) => `## ${hit.record.id}\n${hit.record.instruction}`)
      .join('\n\n');

    const systemPrompt = await this.resolveSystemPrompt(userInput, rulesText, skillsText);
    // 长期记忆召回（三层记忆③）：命中则作为背景知识注入 system prompt。
    const memories = (await this.longTermMemory?.recall(userInput)) ?? [];
    const systemWithMemory =
      memories.length > 0 ? `${systemPrompt}\n\n[长期记忆]\n${memories.join('\n')}` : systemPrompt;
    const history = (await this.memory?.getWindow()) ?? [];
    const messages: ChatMessage[] = [
      { role: 'system', content: systemWithMemory },
      ...history,
      { role: 'user', content: userInput },
    ];
    // 本轮新增消息的起始索引（system + 历史之后），正常结束时回写 memory。
    const sessionStart = 1 + history.length;

    let finalMessage: ChatMessage = { role: 'assistant', content: '' };
    let steps = 0;
    let toolCallsCount = 0;
    let continuations = 0;
    let finishReason: string | undefined;
    const deadline = this.timeoutMs !== undefined ? Date.now() + this.timeoutMs : undefined;

    try {
      // 会话首次开始：触发 onSessionStart（幂等，仅一次）。
      if (!this.sessionStarted) {
        this.sessionStarted = true;
        await this.hooks?.onSessionStart();
      }

      while (steps < this.maxSteps) {
        // 协作式取消：入口检查，中止抛出 AbortError。
        if (signal?.aborted) throw new AbortError();
        // 超时预算：整体耗时超限则优雅终止。
        if (deadline !== undefined && Date.now() > deadline) break;

        steps += 1;
        emit?.({ type: 'step_start', step: steps });

        // beforeLLM 改写的是「本次调用入参」，内部 messages 保持真实历史。
        const llmMessages = await this.hooks?.beforeLLM(messages);

        const tools = this.registry.toToolDefinitions();
        const completionParams = {
          messages: llmMessages ?? messages,
          ...(tools.length > 0 ? { tools } : {}),
          ...(signal ? { signal } : {}),
        };
        let result: ChatCompletionResult;
        if (this.provider.chatCompletionStream) {
          result = await this.provider.chatCompletionStream(completionParams, (delta, kind) =>
            emit?.({ type: 'llm_delta', delta, kind }),
          );
        } else {
          result = await this.provider.chatCompletion(completionParams);
        }

        result = (await this.hooks?.afterLLM(result)) ?? result;

        const assistantMessage = result.message;
        messages.push(assistantMessage);
        finalMessage = assistantMessage;
        finishReason = result.finishReason;

        const toolCalls = assistantMessage.toolCalls ?? [];
        if (toolCalls.length === 0) {
          // finishReason 区分：`length`（max_tokens 截断）在预算内自动续写。
          if (finishReason === 'length' && continuations < this.maxContinuations) {
            continuations += 1;
            messages.push({ role: 'user', content: '你上一条回复被截断，请继续未完成的部分。' });
            await this.hooks?.onStepEnd(steps);
            continue;
          }
          await this.hooks?.onStepEnd(steps);
          break;
        }

        // maxToolCalls 预算：截断本批超出预算的工具，超出部分回填占位消息（保持 tool_call 配对合法）。
        let executable = toolCalls;
        const skipped: ToolCall[] = [];
        if (this.maxToolCalls !== undefined) {
          const remaining = this.maxToolCalls - toolCallsCount;
          if (remaining <= 0) {
            skipped.push(...toolCalls);
            executable = [];
          } else if (toolCalls.length > remaining) {
            executable = toolCalls.slice(0, remaining);
            skipped.push(...toolCalls.slice(remaining));
          }
        }

        if (executable.length > 0) {
          messages.push(
            ...(await this.executeToolCalls(executable, emit, options?.approveToolCall)),
          );
          toolCallsCount += executable.length;
        }
        for (const toolCall of skipped) {
          messages.push({
            role: 'tool',
            content: 'Error: 工具调用次数已达上限，未执行',
            toolCallId: toolCall.id,
            name: this.registry.resolveName(toolCall.function.name),
          });
        }

        await this.hooks?.onStepEnd(steps);
      }

      // 预算兜底强制收尾：循环因 maxSteps/超时退出、但模型仍在调工具、尚未给出最终答案时，
      // 追加一轮「不带工具」的总结调用，避免把带 tool_calls 的中间消息误当最终结果。
      if (finalMessage.toolCalls && finalMessage.toolCalls.length > 0) {
        if (signal?.aborted) throw new AbortError();
        steps += 1;
        emit?.({ type: 'step_start', step: steps });
        messages.push({ role: 'user', content: '请直接给出最终结论，不要再调用任何工具。' });
        const summaryParams = { messages, ...(signal ? { signal } : {}) };
        let summaryResult: ChatCompletionResult;
        if (this.provider.chatCompletionStream) {
          summaryResult = await this.provider.chatCompletionStream(summaryParams, (delta, kind) =>
            emit?.({ type: 'llm_delta', delta, kind }),
          );
        } else {
          summaryResult = await this.provider.chatCompletion(summaryParams);
        }
        summaryResult = (await this.hooks?.afterLLM(summaryResult)) ?? summaryResult;
        finalMessage = summaryResult.message;
        messages.push(finalMessage);
        finishReason = summaryResult.finishReason;
        await this.hooks?.onStepEnd(steps);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      // 取消（AbortError）与业务错误分离：不回写 memory、不触发 onError hook。
      if (err instanceof AbortError) {
        emit?.({ type: 'error', error: 'aborted' });
        throw err;
      }
      emit?.({ type: 'error', error: err.message });
      try {
        await this.hooks?.onError(err, 'agent-loop');
      } catch {
        // onError 钩子自身错误忽略，保留原错误。
      }
      throw err;
    } finally {
      offTrace?.();
      offCustom?.();
      // 清理本轮注册的 skill 工具：覆盖过同名工具则还原，否则移除。
      for (const { name, prior } of registeredSkillTools) {
        if (prior) {
          this.registry.register(prior);
        } else {
          this.registry.unregister(name);
        }
      }
    }

    // 正常结束（自然终止 / maxSteps 兜底 / 超时）时，把本轮消息（system 之外）写回会话记忆。
    // 异常路径（catch 内 throw）不会执行到这里，故不回写，保持历史不变。
    this.memory?.append(messages.slice(sessionStart));

    // 长期记忆写回（三层记忆③）：本轮「用户输入 + 最终答案」作为一条长期记忆（best-effort，失败不阻断）。
    const finalContent = finalMessage.content ?? '';
    if (this.longTermMemory && finalContent) {
      try {
        await this.longTermMemory.remember(`${userInput}\n${finalContent}`);
      } catch {
        // 长期记忆写回失败忽略，不影响本轮结果。
      }
    }

    emit?.({ type: 'done', finalMessage, steps });
    return { finalMessage, messages, steps, finishReason };
  }

  /** 结束会话：触发 `onSessionEnd`（幂等）并清空会话记忆。 */
  async endSession(): Promise<void> {
    if (this.sessionEnded) return;
    this.sessionEnded = true;
    await this.hooks?.onSessionEnd();
    this.memory?.clear();
  }

  /**
   * 执行一批 tool_calls：guardrail / hooks 按序（可观测、可阻断），
   * 工具执行并发（`Promise.allSettled`，单个失败不阻塞其他），结果按原序回填。
   */
  private async executeToolCalls(
    toolCalls: ToolCall[],
    emit: ((event: AgentRunEvent) => void) | undefined,
    approveToolCall?: (name: string, args: string) => Promise<ToolApproval>,
  ): Promise<ChatMessage[]> {
    // Phase 1：顺序做名字反查 / 入参规范化 / beforeToolCall / guardrail 校验，收集执行计划。
    const plans: {
      toolCall: ToolCall;
      name: string;
      args: string;
      blocked: boolean;
      blockedReason: string | undefined;
    }[] = [];
    for (const toolCall of toolCalls) {
      // LLM 回调的是合法名（如 builtin_read_file），反查真实语义名（builtin.read_file）。
      const name = this.registry.resolveName(toolCall.function.name);
      // 空/非法入参兜底为 {}，并写回 toolCall（同一对象引用 → 历史消息同步）。
      const normalizedArgs = normalizeToolArgs(toolCall.function.arguments);
      toolCall.function.arguments = normalizedArgs;
      const args = (await this.hooks?.beforeToolCall(name, normalizedArgs)) ?? normalizedArgs;
      emit?.({ type: 'tool_call', name, args });

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
      // Human-in-the-loop：guardrail 放行后、执行前，await 人类审批；拒绝则阻断并回填原因。
      if (!blocked && approveToolCall) {
        const decision = await approveToolCall(name, args);
        if (!decision.approved) {
          blocked = true;
          blockedReason = decision.reason ?? 'Rejected by human';
        }
      }
      plans.push({ toolCall, name, args, blocked, blockedReason });
    }

    // Phase 2：并发执行（含重试）；被 guardrail 阻断的直接产出 Blocked 结果。
    const executed = await Promise.all(
      plans.map(async (plan): Promise<string> => {
        if (plan.blocked) {
          return `Blocked: ${plan.blockedReason ?? 'guardrail denied'}`;
        }
        try {
          const output = await this.executeWithRetry(plan.name, plan.args);
          return JSON.stringify(output);
        } catch (error) {
          return `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
      }),
    );

    // Phase 3：顺序做 guardrail afterToolCall / afterToolCall / 事件 / 回填。
    const toolMessages: ChatMessage[] = [];
    for (let i = 0; i < plans.length; i += 1) {
      const plan = plans[i];
      const raw = executed[i];
      if (!plan || raw === undefined) continue;
      let toolResult = raw;

      const afterRules = this.guardrails?.forPoint('afterToolCall') ?? [];
      for (const rule of afterRules) {
        const verdict = await rule.validate({ toolName: plan.name, result: toolResult });
        if (!verdict.allowed) {
          toolResult = `Blocked: ${verdict.reason ?? 'guardrail denied'}`;
          break;
        }
      }

      toolResult = (await this.hooks?.afterToolCall(plan.name, toolResult)) ?? toolResult;
      emit?.({ type: 'tool_result', name: plan.name, result: toolResult });

      toolMessages.push({
        role: 'tool',
        content: toolResult,
        toolCallId: plan.toolCall.id,
        name: plan.name,
      });
    }
    return toolMessages;
  }

  /** 带指数退避重试的工具执行；`maxRetries` 为 0 时不重试。 */
  private async executeWithRetry(name: string, args: string): Promise<unknown> {
    const maxRetries = this.toolRetry.maxRetries;
    let attempt = 0;
    for (;;) {
      try {
        return await this.registry.execute(name, args);
      } catch (error) {
        if (attempt >= maxRetries) throw error;
        attempt += 1;
        await sleep(this.toolRetry.baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }

  /** 解析本次 system prompt：函数式动态生成 / 静态字符串原样返回 / 模板对象自动检索组装。 */
  private async resolveSystemPrompt(
    userInput: string,
    rulesText: string,
    skillsText: string,
  ): Promise<string> {
    if (typeof this.systemPrompt === 'function') {
      return this.appendContext(await this.systemPrompt(userInput), rulesText, skillsText);
    }
    if (typeof this.systemPrompt === 'string') {
      return this.appendContext(this.systemPrompt, rulesText, skillsText);
    }
    // SystemPrompt 模板对象：渲染变量 + 注入 rules / skills 文本（buildSystemPrompt 内部有兜底追加）。
    return buildSystemPrompt({ systemPrompt: this.systemPrompt, rulesText, skillsText });
  }

  /** 把 rules/skills 文本兜底追加到基础 prompt 之后（string / 函数式形态同样生效）。 */
  private appendContext(base: string, rulesText: string, skillsText: string): string {
    const extra = [rulesText, skillsText].filter((text) => text).join('\n\n');
    return extra ? `${base}\n\n${extra}` : base;
  }
}
