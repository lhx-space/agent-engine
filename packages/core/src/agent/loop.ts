import type { ChatCompletionResult, ChatMessage, LLMProvider } from '../llm/types';
import type { HookPipeline } from '../hooks/pipeline';
import type { ToolRegistry } from '../tools/registry';

export interface AgentLoopOptions {
  provider: LLMProvider;
  registry: ToolRegistry;
  systemPrompt: string;
  /** 最大 LLM 调用步数，默认 10，用于防死循环。 */
  maxSteps?: number;
  /** 生命周期钩子管线，可省略。 */
  hooks?: HookPipeline;
}

export interface AgentLoopResult {
  /** 最终 assistant 消息。 */
  finalMessage: ChatMessage;
  /** 完整消息序列（system + user + assistant/tool 交替）。 */
  messages: ChatMessage[];
  /** 实际执行的 LLM 调用步数。 */
  steps: number;
}

/** 单 Agent ReAct 执行循环。 */
export class AgentLoop {
  private readonly provider: LLMProvider;
  private readonly registry: ToolRegistry;
  private readonly systemPrompt: string;
  private readonly maxSteps: number;
  private readonly hooks: HookPipeline | undefined;

  constructor(options: AgentLoopOptions) {
    this.provider = options.provider;
    this.registry = options.registry;
    this.systemPrompt = options.systemPrompt;
    this.maxSteps = options.maxSteps ?? 10;
    this.hooks = options.hooks;
  }

  async run(userInput: string): Promise<AgentLoopResult> {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: userInput },
    ];

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

          let toolResult: string;
          try {
            const output = await this.registry.execute(name, args);
            toolResult = JSON.stringify(output);
          } catch (error) {
            toolResult = `Error: ${error instanceof Error ? error.message : String(error)}`;
          }

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

    return { finalMessage, messages, steps };
  }
}
