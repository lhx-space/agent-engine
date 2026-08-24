import type { Rule, SystemPrompt } from '@agent-engine/config';
import type { HookPipeline } from '../hooks/pipeline';
import type { HookTrace } from '../hooks/types';
import type { ChatMessage, LLMProvider } from '../llm/types';
import type { ConversationMemory } from '../memory/conversation-memory';
import type { RuleRegistry } from '../rules/registry';
import type { Skill } from '../skills/types';
import type { ToolRegistry } from '../tools/registry';

/**
 * system prompt 三种形态：
 * - string：静态字符串；
 * - SystemPrompt：模板对象（配合 `rules` 每次 run 自动检索注入）；
 * - 函数：按 userInput 动态生成（完全自定义组装）。
 */
export type SystemPromptInput =
  string | SystemPrompt | ((userInput: string) => string | Promise<string>);

export interface AgentLoopOptions {
  provider: LLMProvider;
  registry: ToolRegistry;
  systemPrompt: SystemPromptInput;
  /** 最大 LLM 调用步数，默认 10，用于防死循环。 */
  maxSteps?: number;
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
  /** 可复用能力包（可选），按 query 检索命中后注入指令 + 注册捆绑工具。 */
  skills?: Skill[];
}

export interface AgentLoopResult {
  /** 最终 assistant 消息。 */
  finalMessage: ChatMessage;
  /** 完整消息序列（system + user + assistant/tool 交替）。 */
  messages: ChatMessage[];
  /** 实际执行的 LLM 调用步数。 */
  steps: number;
}

/** 运行时事件（可观测）：step / 文本增量 / 工具调用 / 工具结果 / hook trace / 结束 / 错误。 */
export type AgentRunEvent =
  | { type: 'step_start'; step: number }
  | { type: 'llm_delta'; delta: string }
  | { type: 'tool_call'; name: string; args: string }
  | { type: 'tool_result'; name: string; result: string }
  | { type: 'hook'; trace: HookTrace }
  | { type: 'done'; finalMessage: ChatMessage; steps: number }
  | { type: 'error'; error: string };

/** `run` 的可选参数。 */
export interface AgentRunOptions {
  /** 运行时事件回调（流式 / 非流式均触发）。 */
  onEvent?: (event: AgentRunEvent) => void;
}
