import type { ChatCompletionResult, ChatMessage } from '../llm/types';

/**
 * 生命周期钩子。可改写类方法返回 `T | void`：返回新值表示改写，返回 void 表示保持原值。
 * hooks 不做阻断——阻断是 rules（guardrail）的职责。
 */
export interface Hook {
  /** 钩子唯一标识。 */
  name: string;
  /** 调用模型前，可改写传给 LLM 的消息（如注入上下文）。 */
  beforeLLM?(messages: ChatMessage[]): Promise<ChatMessage[] | void>;
  /** 模型返回后，可改写结果或记录。 */
  afterLLM?(result: ChatCompletionResult): Promise<ChatCompletionResult | void>;
  /** 工具执行前，可改写工具入参（JSON 字符串）。 */
  beforeToolCall?(name: string, args: string): Promise<string | void>;
  /** 工具执行后，可改写工具结果或审计。 */
  afterToolCall?(name: string, result: string): Promise<string | void>;
  /** 每轮循环结束。 */
  onStepEnd?(step: number): Promise<void>;
  /** 任意错误发生。 */
  onError?(error: Error, phase: string): Promise<void>;
}
