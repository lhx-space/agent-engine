import type { DocumentIndex } from '../documents/document-index';
import type { ContextContributor } from '../context/context-contributor';
import type { SystemPromptInput } from '../context/types';
import type { EmbeddingProvider } from '../embedding/embedding';
import type { EventBus } from '../events/event-bus';
import type { HookPipeline } from '../hooks/pipeline';
import type { HookTrace } from '../hooks/types';
import type { ChatMessage, DeltaKind, FinishReason, LLMProvider } from '../llm/types';
import type { ConversationMemory } from '../memory/conversation-memory';
import type { LongTermMemory } from '../memory/long-term-memory';
import type { GuardrailRule } from '../guardrails';
import type { ToolRegistry } from '../tools/registry';

export type { SystemPromptInput } from '../context/types';

/**
 * AgentLoop 接受的执行参数（可省略任意字段，缺省对齐现状）。
 * 配置层的 `ExecutionConfig`（已套默认值）可直接赋给该类型。
 */
export interface AgentExecutionOptions {
  maxSteps?: number;
  maxToolCalls?: number;
  timeoutMs?: number;
  toolRetry?: { maxRetries?: number; baseDelayMs?: number };
  maxContinuations?: number;
}

export interface AgentLoopOptions {
  provider: LLMProvider;
  registry: ToolRegistry;
  systemPrompt: SystemPromptInput;
  /** 最大 LLM 调用步数，默认 10，用于防死循环。 */
  maxSteps?: number;
  /** 执行预算 / 重试 / 续写策略（可选，缺省对齐现状）。 */
  execution?: AgentExecutionOptions;
  /** 生命周期钩子管线，可省略。 */
  hooks?: HookPipeline;
  /** guardrail 规则（安全拦截），可省略。 */
  guardrails?: GuardrailRule[];
  /** 会话记忆（可选），注入后跨 run 累积历史，实现多轮对话。 */
  memory?: ConversationMemory;
  /** 长期记忆（可选），run 开始召回注入、正常结束写回（三层记忆③）。 */
  longTermMemory?: LongTermMemory;
  /** 文档检索索引（可选），run 时检索 top-k 注入 `[文档]`。 */
  documentIndex?: DocumentIndex;
  /** 语义召回 provider（可选）：能力包自建索引可传入，升级为 BM25 + 向量 RRF 融合。 */
  embeddingProvider?: EmbeddingProvider;
  /** 上下文贡献者（可选）：run 组装前收集，文本注入 prompt、工具临时注册。 */
  contextContributors?: ContextContributor[];
  /** 事件总线（可选）：run 期间把总线 `custom` 事件转发到 `onEvent`。 */
  eventBus?: EventBus;
}

/** run 的结束方式（结果归一化）：自然结束 / 达到 maxSteps / 超时。 */
export type AgentRunOutcome = { kind: 'completed' } | { kind: 'max_steps' } | { kind: 'timeout' };

export interface AgentLoopResult {
  /** 最终 assistant 消息。 */
  finalMessage: ChatMessage;
  /** 完整消息序列（system + user + assistant/tool 交替）。 */
  messages: ChatMessage[];
  /** 实际执行的 LLM 调用步数。 */
  steps: number;
  /** 跨 provider 归一化的结束原因（stop / length / tool_calls / content_filter / unknown）。 */
  finishReason?: FinishReason;
  /** run 的结束方式（completed / max_steps / timeout）。 */
  outcome: AgentRunOutcome;
}

/** 运行时事件（可观测）：step / 文本增量 / 工具调用 / 工具结果 / hook trace / 结束 / 错误 / 自定义。 */
export type AgentRunEvent =
  | { type: 'step_start'; step: number }
  | { type: 'llm_delta'; delta: string; kind?: DeltaKind }
  | { type: 'tool_call'; name: string; args: string }
  | { type: 'tool_result'; name: string; result: string }
  | { type: 'hook'; trace: HookTrace }
  | { type: 'done'; finalMessage: ChatMessage; steps: number }
  | { type: 'error'; error: string }
  /** 自定义事件（经事件总线 `custom` 转发或用户直接 emit）。 */
  | { type: 'custom'; name: string; data?: unknown };

/** Human-in-the-loop 工具审批决定。 */
export interface ToolApproval {
  approved: boolean;
  /** 拒绝原因（approved=false 时回填给模型）。 */
  reason?: string;
}

/** `run` 的可选参数。 */
export interface AgentRunOptions {
  /** 运行时事件回调（流式 / 非流式均触发）。 */
  onEvent?: (event: AgentRunEvent) => void;
  /** 取消信号；中止时抛出 `AbortError`，不回写会话记忆。 */
  signal?: AbortSignal;
  /** Human-in-the-loop：工具执行前 await 审批；`false` 阻断（结果回填「Rejected by human」）。 */
  approveToolCall?: (name: string, args: string) => Promise<ToolApproval>;
}
