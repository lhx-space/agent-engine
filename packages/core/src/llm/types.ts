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

/** 工具调用策略（openai-compatible 语义；anthropic 由适配层映射）。 */
export type ToolChoice =
  'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };

/** 结构化输出格式（`json_object` 或带 schema 的 `json_schema`）。 */
export type ResponseFormat =
  | { type: 'json_object' }
  | {
      type: 'json_schema';
      json_schema: { name: string; schema: Record<string, unknown>; strict?: boolean };
    };

export interface ChatCompletionParams {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  /** 核采样 top_p（0~1）；缺省取 `ModelConfig.topP`。 */
  topP?: number;
  /** 高频 token 惩罚（-2~2，OpenAI 兼容系）；缺省取 `ModelConfig.frequencyPenalty`。 */
  frequencyPenalty?: number;
  /** 已出现 token 惩罚（-2~2，OpenAI 兼容系）；缺省取 `ModelConfig.presencePenalty`。 */
  presencePenalty?: number;
  /** 停止序列；命中即停；缺省取 `ModelConfig.stop`。 */
  stop?: string[];
  /** 随机种子（OpenAI 兼容系可复现）；缺省取 `ModelConfig.seed`。 */
  seed?: number;
  /** 工具调用策略；缺省取 `ModelConfig.toolChoice`。 */
  toolChoice?: ToolChoice;
  /** 是否允许并行多工具调用；缺省取 `ModelConfig.parallelToolCalls`。 */
  parallelToolCalls?: boolean;
  /** vendor 原生参数透传兜底（顶层展开）；缺省取 `ModelConfig.extra`。 */
  extra?: Record<string, unknown>;
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
