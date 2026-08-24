export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    /** JSON 字符串，对齐 OpenAI 的 `function.arguments`。 */
    arguments: string;
  };
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** assistant 消息携带的模型工具调用。 */
  toolCalls?: ToolCall[];
  /** tool 消息对应的工具调用 id（工具执行结果回填）。 */
  toolCallId?: string;
  /** tool 消息对应的工具名。 */
  name?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    /** JSON Schema 对象。 */
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionParams {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ChatCompletionResult {
  message: ChatMessage;
  usage?: TokenUsage;
  finishReason?: string;
}

export interface LLMProvider {
  readonly name: string;
  chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult>;
  /**
   * 流式 chat completion（可选方法）。文本增量经 `onDelta(delta)` 逐段回调，
   * 最终仍返回完整 `ChatCompletionResult`（含聚合后的 tool_calls / usage）。
   */
  chatCompletionStream?(
    params: ChatCompletionParams,
    onDelta: (delta: string) => void,
  ): Promise<ChatCompletionResult>;
}
