export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

/** 运行被取消（AbortSignal）时抛出的错误，与业务错误分离，供上层识别。 */
export class AbortError extends Error {
  constructor(message = 'Agent run aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

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
  /** 模型思考内容（如 DeepSeek R1 的 reasoning_content），与 content 分离。 */
  reasoning?: string;
  /** assistant 消息携带的模型工具调用。 */
  toolCalls?: ToolCall[];
  /** tool 消息对应的工具调用 id（工具执行结果回填）。 */
  toolCallId?: string;
  /** tool 消息对应的工具名。 */
  name?: string;
}

/** 流式增量类型：思考（reasoning）或回复（content）。 */
export type DeltaKind = 'reasoning' | 'content';

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    /** JSON Schema 对象。 */
    parameters: Record<string, unknown>;
  };
}

/** 结构化输出格式（首版仅 JSON 对象）。 */
export interface ResponseFormat {
  type: 'json_object';
}

export interface ChatCompletionParams {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** 请求结构化输出（openai-compatible 透传为 response_format）。 */
  responseFormat?: ResponseFormat;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** 跨 provider 归一化的结束原因。 */
export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'unknown';

/** 模型调用失败的类型化封装（`cause` 保留原错误）。 */
export class CompletionError extends Error {
  constructor(cause?: unknown) {
    super(
      `model completion failed: ${cause instanceof Error ? cause.message : String(cause ?? 'unknown error')}`,
      { cause },
    );
    this.name = 'CompletionError';
  }
}

export interface ChatCompletionResult {
  message: ChatMessage;
  usage?: TokenUsage;
  finishReason?: FinishReason;
}

export interface LLMProvider {
  readonly name: string;
  chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult>;
  /**
   * 流式 chat completion（可选方法）。文本增量经 `onDelta(delta, kind)` 逐段回调
   * （`kind` 区分思考 / 回复，缺省 `content`），最终仍返回完整 `ChatCompletionResult`
   * （含聚合后的 tool_calls / usage）。
   */
  chatCompletionStream?(
    params: ChatCompletionParams,
    onDelta: (delta: string, kind?: DeltaKind) => void,
  ): Promise<ChatCompletionResult>;
}
