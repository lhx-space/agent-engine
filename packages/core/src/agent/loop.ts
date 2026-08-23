import type { ChatCompletionResult, ChatMessage, LLMProvider } from '../llm/types';
import type { ToolRegistry } from '../tools/registry';

/** 生命周期钩子。首版为可选节点，M2 实现配置驱动的 hooks 管线。 */
export interface AgentHooks {
  beforeLLM?(messages: ChatMessage[]): Promise<void>;
  afterLLM?(result: ChatCompletionResult): Promise<void>;
  beforeToolCall?(name: string, args: string): Promise<void>;
  afterToolCall?(name: string, result: string): Promise<void>;
}

export interface AgentLoopOptions {
  provider: LLMProvider;
  registry: ToolRegistry;
  systemPrompt: string;
  /** 最大 LLM 调用步数，默认 10，用于防死循环。 */
  maxSteps?: number;
  hooks?: AgentHooks;
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
  private readonly hooks: AgentHooks;

  constructor(options: AgentLoopOptions) {
    this.provider = options.provider;
    this.registry = options.registry;
    this.systemPrompt = options.systemPrompt;
    this.maxSteps = options.maxSteps ?? 10;
    this.hooks = options.hooks ?? {};
  }

  async run(userInput: string): Promise<AgentLoopResult> {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: userInput },
    ];

    let finalMessage: ChatMessage = { role: 'assistant', content: '' };
    let steps = 0;

    while (steps < this.maxSteps) {
      steps += 1;

      await this.hooks.beforeLLM?.(messages);

      const tools = this.registry.toToolDefinitions();
      const result = await this.provider.chatCompletion({
        messages,
        ...(tools.length > 0 ? { tools } : {}),
      });

      await this.hooks.afterLLM?.(result);

      const assistantMessage = result.message;
      messages.push(assistantMessage);
      finalMessage = assistantMessage;

      const toolCalls = assistantMessage.toolCalls ?? [];
      if (toolCalls.length === 0) {
        break;
      }

      for (const toolCall of toolCalls) {
        const name = toolCall.function.name;
        const args = toolCall.function.arguments;

        await this.hooks.beforeToolCall?.(name, args);

        let toolResult: string;
        try {
          const output = await this.registry.execute(name, args);
          toolResult = JSON.stringify(output);
        } catch (error) {
          toolResult = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }

        await this.hooks.afterToolCall?.(name, toolResult);

        messages.push({
          role: 'tool',
          content: toolResult,
          toolCallId: toolCall.id,
          name,
        });
      }
    }

    return { finalMessage, messages, steps };
  }
}
