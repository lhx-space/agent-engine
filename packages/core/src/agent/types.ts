import type { Rule } from '@agent-engine/config';
import type { SystemPromptInput } from '../context/types';
import type { EventBus } from '../events/event-bus';
import type { HookPipeline } from '../hooks/pipeline';
import type { HookTrace } from '../hooks/types';
import type { ChatMessage, DeltaKind, LLMProvider } from '../llm/types';
import type { ConversationMemory } from '../memory/conversation-memory';
import type { LongTermMemory } from '../memory/long-term-memory';
import type { RuleRegistry } from '../rules/registry';
import type { Skill } from '../skills/types';
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
  /**
   * 上下文规则（可配置文本规则）。`systemPrompt` 为模板对象时，
   * 每次 run 自动按 userInput 检索并注入；否则被忽略。
   */
  rules?: Rule[];
  /** guardrail 规则注册表（安全拦截），可省略。 */
  guardrails?: RuleRegistry;
  /** 会话记忆（可选），注入后跨 run 累积历史，实现多轮对话。 */
  memory?: ConversationMemory;
  /** 长期记忆（可选），run 开始召回注入、正常结束写回（三层记忆③）。 */
  longTermMemory?: LongTermMemory;
  /** 可复用能力包（可选），按 query 检索命中后注入指令 + 注册捆绑工具。 */
  skills?: Skill[];
  /** 事件总线（可选）：run 期间把总线 `custom` 事件转发到 `onEvent`。 */
  eventBus?: EventBus;
}

export interface AgentLoopResult {
  /** 最终 assistant 消息。 */
  finalMessage: ChatMessage;
  /** 完整消息序列（system + user + assistant/tool 交替）。 */
  messages: ChatMessage[];
  /** 实际执行的 LLM 调用步数。 */
  steps: number;
  /** 最终模型返回的 finishReason（stop / length / 其他）。 */
  finishReason?: string;
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
