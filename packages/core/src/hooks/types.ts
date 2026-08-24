import type { ChatCompletionResult, ChatMessage } from '../llm/types';

/** hook 触发点（有限生命周期锚点，对齐 Hook 接口方法）。 */
export type HookPoint =
  'beforeLLM' | 'afterLLM' | 'beforeToolCall' | 'afterToolCall' | 'onStepEnd' | 'onError';

/** hook 单次执行的 trace：谁、在哪个点、耗时、是否改写了值。 */
export interface HookTrace {
  hook: string;
  point: HookPoint;
  durationMs: number;
  /** true = 返回了与入参不同的值（改写）；false = 返回 void（仅观察）。 */
  changed: boolean;
}

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
