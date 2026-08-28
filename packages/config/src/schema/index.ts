import { z } from 'zod';

// ============ model ============

export const ModelProviderSchema = z.enum(['openai-compatible', 'anthropic', 'custom']);
export type ModelProvider = z.infer<typeof ModelProviderSchema>;

/** 工具调用策略（openai-compatible 语义；anthropic 由适配层映射为 auto/none/any/tool）。 */
export const ToolChoiceSchema = z.union([
  z.enum(['auto', 'none', 'required']),
  z.object({ type: z.literal('function'), function: z.object({ name: z.string() }) }),
]);
export type ToolChoice = z.infer<typeof ToolChoiceSchema>;

/** 单个模型配置（不含 `fallbacks`；`fallbacks` 里的模型是「叶子」，不能再嵌套 fallback）。 */
export const BaseModelConfigSchema = z.object({
  provider: ModelProviderSchema.default('openai-compatible'),
  baseURL: z.string().optional(),
  /** 显式 API Key；缺省时回退环境变量（DEEPSEEK_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY）。 */
  apiKey: z.string().optional(),
  model: z.string(),
  /** 采样温度（0~2）。 */
  temperature: z.number().optional(),
  maxTokens: z.number().int().positive().optional(),
  /** 核采样 top_p（0~1；openai-compatible / anthropic）。 */
  topP: z.number().min(0).max(1).optional(),
  /** 高频 token 惩罚（-2~2；openai-compatible）。 */
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  /** 已出现 token 惩罚（-2~2；openai-compatible）。 */
  presencePenalty: z.number().min(-2).max(2).optional(),
  /** 停止序列数组；命中即停（openai-compatible / anthropic）。 */
  stop: z.array(z.string()).optional(),
  /** 随机种子（openai-compatible 可复现；anthropic 不支持）。 */
  seed: z.number().int().optional(),
  /** 工具调用策略（openai-compatible 透传；anthropic 映射）。 */
  toolChoice: ToolChoiceSchema.optional(),
  /** 是否允许并行多工具调用（openai-compatible；anthropic 忽略）。 */
  parallelToolCalls: z.boolean().optional(),
  /** vendor 原生参数透传兜底（顶层展开；优先用归一化字段，避免与之冲突）。 */
  extra: z.record(z.string(), z.unknown()).optional(),
});
export type BaseModelConfig = z.infer<typeof BaseModelConfigSchema>;

export const ModelConfigSchema = BaseModelConfigSchema.extend({
  /** 备用模型列表（主模型失败重试耗尽后依次 fallback）。 */
  fallbacks: z.array(BaseModelConfigSchema).default([]),
});
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

// ============ systemPrompt ============

export const SystemPromptSchema = z.object({
  template: z.string(),
  variables: z.record(z.string(), z.unknown()).optional(),
});
export type SystemPrompt = z.infer<typeof SystemPromptSchema>;

// ============ hooks / rules ============

export const HookPointSchema = z.enum([
  'onInit',
  'onSessionStart',
  'beforeContextCompose',
  'beforeLLM',
  'afterLLM',
  'beforeToolCall',
  'afterToolCall',
  'onStepEnd',
  'onSessionEnd',
  'onError',
]);
export type HookPoint = z.infer<typeof HookPointSchema>;

export const RuleKindSchema = z.enum(['always', 'on-demand']);
export type RuleKind = z.infer<typeof RuleKindSchema>;

export const RuleSchema = z.object({
  id: z.string(),
  kind: RuleKindSchema.default('on-demand'),
  description: z.string(),
  content: z.string(),
  tags: z.array(z.string()).default([]),
});
export type Rule = z.infer<typeof RuleSchema>;

export const HookConfigSchema = z.object({
  plugin: z.string(),
  on: z.array(HookPointSchema),
});
export type HookConfig = z.infer<typeof HookConfigSchema>;

// ============ tools / skills / mcp ============

/**
 * 工具轴配置：`disabled` 按语义名禁用任意已装配工具（builtin.* / plugin / MCP 工具名）。
 * 禁用是装配末的统一过滤，故可覆盖三类来源；缺省空数组 = 全部照常注册。
 */
export const ToolsConfigSchema = z.object({
  disabled: z.array(z.string()).default([]),
});
export type ToolsConfig = z.infer<typeof ToolsConfigSchema>;

/**
 * 技能来源（一等公民，可插拔）：
 * - `path` 本地目录（含 SKILL.md）
 * - `npm` npm 包（从 registry 拉取）
 * - `git` git 仓库（clone 拉取）
 */
export const SkillSourceSchema = z.enum(['path', 'npm', 'git']);
export type SkillSource = z.infer<typeof SkillSourceSchema>;

export const SkillRefSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('path'), path: z.string() }),
  z.object({ source: z.literal('npm'), package: z.string(), version: z.string().optional() }),
  z.object({ source: z.literal('git'), url: z.string(), ref: z.string().optional() }),
]);
export type SkillRef = z.infer<typeof SkillRefSchema>;

/**
 * MCP server 来源：
 * - `command` 本地命令（stdio transport）
 * - `registry` 官方 MCP registry / npm 包（归一化为 `npx -y <package>`）
 * - `http` 远程 MCP（streamable-http / sse transport，经 URL + 可选 headers 认证）
 */
export const McpServerSourceSchema = z.enum(['command', 'registry', 'http']);
export type McpServerSource = z.infer<typeof McpServerSourceSchema>;

/** 远程 MCP 传输（streamable-http 优先；sse 兼容旧 server）。 */
export const McpRemoteTransportSchema = z.enum(['streamable-http', 'sse']);
export type McpRemoteTransport = z.infer<typeof McpRemoteTransportSchema>;

const McpServerCommon = {
  name: z.string(),
  env: z.record(z.string(), z.string()).optional(),
};

export const McpServerSchema = z.discriminatedUnion('source', [
  z.object({
    ...McpServerCommon,
    source: z.literal('command'),
    command: z.string(),
    args: z.array(z.string()).default([]),
  }),
  z.object({
    ...McpServerCommon,
    source: z.literal('registry'),
    package: z.string(),
    args: z.array(z.string()).default([]),
  }),
  z.object({
    ...McpServerCommon,
    source: z.literal('http'),
    url: z.string().url(),
    transport: McpRemoteTransportSchema.default('streamable-http'),
    headers: z.record(z.string(), z.string()).optional(),
  }),
]);
export type McpServer = z.infer<typeof McpServerSchema>;

export const McpConfigSchema = z.object({
  servers: z.array(McpServerSchema).default([]),
});
export type McpConfig = z.infer<typeof McpConfigSchema>;

// ============ memory ============

export const SessionMemorySchema = z.object({
  maxMessages: z.number().int().positive().optional(),
  /** token 预算（三层记忆①）：超过则按整轮边界从头部淘汰。 */
  maxTokens: z.number().int().positive().optional(),
  /** 滚动摘要（三层记忆②）：裁剪淘汰的旧轮经 LLM 摘要注入，默认关闭。 */
  summary: z.boolean().default(false),
});
export type SessionMemory = z.infer<typeof SessionMemorySchema>;

export const LongTermMemorySchema = z.object({
  backend: z.string().default('in-memory'),
});
export type LongTermMemory = z.infer<typeof LongTermMemorySchema>;

export const MemoryConfigSchema = z.object({
  session: SessionMemorySchema.optional(),
  longTerm: LongTermMemorySchema.optional(),
});
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;

// ============ cache ============

export const CacheConfigSchema = z.object({
  /** 缓存后端名（默认 in-memory；redis 等经插件 registerCacheBackend 注册后按名选中）。 */
  backend: z.string().default('in-memory'),
});
export type CacheConfig = z.infer<typeof CacheConfigSchema>;

// ============ embedding ============

export const EmbeddingConfigSchema = z.object({
  provider: ModelProviderSchema.default('openai-compatible'),
  baseURL: z.string().url().optional(),
  apiKey: z.string().optional(),
  model: z.string(),
  /** 向量维度；缺省时取首次响应向量长度。 */
  dimension: z.number().int().positive().optional(),
});
export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>;

// ============ documents ============

export const DocumentChunkingStrategySchema = z.enum(['fixed', 'heading']);
export type DocumentChunkingStrategy = z.infer<typeof DocumentChunkingStrategySchema>;

export const DocumentChunkingSchema = z.object({
  strategy: DocumentChunkingStrategySchema.default('heading'),
  size: z.number().int().positive().default(1000),
  overlap: z.number().int().nonnegative().default(0),
});
export type DocumentChunking = z.infer<typeof DocumentChunkingSchema>;

export const DocumentsConfigSchema = z.object({
  /** 文档源路径数组（文件或目录，目录递归）。 */
  sources: z.array(z.string()).default([]),
  chunking: DocumentChunkingSchema.default(DocumentChunkingSchema.parse({})),
  /** 每次 run 检索注入的 top-k 数量，默认 4。 */
  topK: z.number().int().positive().default(4),
});
export type DocumentsConfig = z.infer<typeof DocumentsConfigSchema>;

// ============ orchestration ============

export const OrchestrationModeSchema = z.enum(['single', 'sequential', 'parallel', 'graph']);
export type OrchestrationMode = z.infer<typeof OrchestrationModeSchema>;

export const OrchestrationSchema = z.object({
  mode: OrchestrationModeSchema.default('single'),
});
export type Orchestration = z.infer<typeof OrchestrationSchema>;

// ============ execution ============

export const ToolRetrySchema = z.object({
  /** 工具执行失败后的最大重试次数；0 = 不重试（默认，向后兼容）。 */
  maxRetries: z.number().int().nonnegative().default(0),
  /** 指数退避基数（毫秒）：baseDelayMs * 2^attempt。 */
  baseDelayMs: z.number().int().nonnegative().default(500),
});
export type ToolRetry = z.infer<typeof ToolRetrySchema>;

export const ExecutionConfigSchema = z.object({
  /** 最大 LLM 调用步数（默认 10，防死循环）。 */
  maxSteps: z.number().int().positive().default(10),
  /** 单次 run 内工具调用总数上限；缺省无限制。 */
  maxToolCalls: z.number().int().positive().optional(),
  /** 单次 run 整体耗时上限（毫秒）；缺省无限制。 */
  timeoutMs: z.number().int().positive().optional(),
  /** 工具执行失败重试策略。 */
  toolRetry: ToolRetrySchema.default(ToolRetrySchema.parse({})),
  /** LLM 调用失败重试策略（主模型重试耗尽后 fallback 到 `model.fallbacks`）。 */
  llmRetry: ToolRetrySchema.default(ToolRetrySchema.parse({})),
  /** `finishReason='length'`（max_tokens 截断）时的自动续写次数上限；0 = 不续写。 */
  maxContinuations: z.number().int().nonnegative().default(1),
});
export type ExecutionConfig = z.infer<typeof ExecutionConfigSchema>;

// ============ security / sandbox ============

export const SandboxBackendKindSchema = z.enum(['docker', 'nsjail', 'auto']);
export type SandboxBackendKind = z.infer<typeof SandboxBackendKindSchema>;

export const SandboxConfigSchema = z.object({
  backend: SandboxBackendKindSchema.default('auto'),
  image: z.string().default('agent-engine/sandbox'),
  workspaceRoot: z.string().optional(),
  compact: z.boolean().default(false),
});
export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;

export const BashPolicySchema = z.object({
  enabled: z.boolean().default(false),
  allowCommands: z.array(z.string()).default([]),
  denyPatterns: z.array(z.string()).default([]),
  allowNetwork: z.boolean().default(false),
  timeoutMs: z.number().int().positive().default(30_000),
  maxOutputBytes: z.number().int().positive().default(65_536),
});
export type BashPolicy = z.infer<typeof BashPolicySchema>;

export const FilePolicySchema = z.object({
  roots: z.array(z.string()).default([]),
  maxFileBytes: z.number().int().positive().default(1_048_576),
});
export type FilePolicy = z.infer<typeof FilePolicySchema>;

export const WebPolicySchema = z.object({
  allowDomains: z.array(z.string()).default([]),
  denyDomains: z.array(z.string()).default([]),
  timeoutMs: z.number().int().positive().default(15_000),
  maxOutputBytes: z.number().int().positive().default(32_768),
});
export type WebPolicy = z.infer<typeof WebPolicySchema>;

export const WebSearchProviderSchema = z.enum(['searxng', 'duckduckgo', 'tavily', 'serper']);
export type WebSearchProvider = z.infer<typeof WebSearchProviderSchema>;

export const WebSearchPolicySchema = z.object({
  provider: WebSearchProviderSchema.default('searxng'),
  /** SearXNG 实例 baseURL（如 `http://localhost:8080`）；provider 为 searxng 时用于构造 `/search`。 */
  endpoint: z.string().url().optional(),
  /** tavily / serper 的 API key；provider 为二者时必需（可经 `${VAR}` 插值注入）。 */
  apiKey: z.string().optional(),
  /** 主 provider 缺失必需配置或运行期失败/空结果时回退的 provider（默认 duckduckgo，keyless）。 */
  fallback: WebSearchProviderSchema.default('duckduckgo'),
  maxResults: z.number().int().positive().default(8),
  timeoutMs: z.number().int().positive().default(10_000),
});
export type WebSearchPolicy = z.infer<typeof WebSearchPolicySchema>;

// 各子 Schema 的完整默认值（Zod `.default({})` 不会级联内层字段默认值，故显式给出全量默认）。
const DEFAULT_SANDBOX = SandboxConfigSchema.parse({});
const DEFAULT_BASH = BashPolicySchema.parse({});
const DEFAULT_FILES = FilePolicySchema.parse({});
const DEFAULT_WEB_SEARCH = WebSearchPolicySchema.parse({});
const DEFAULT_WEB_FETCH = WebPolicySchema.parse({});

export const SecurityConfigSchema = z.object({
  sandbox: SandboxConfigSchema.default(DEFAULT_SANDBOX),
  bash: BashPolicySchema.default(DEFAULT_BASH),
  files: FilePolicySchema.default(DEFAULT_FILES),
  webSearch: WebSearchPolicySchema.default(DEFAULT_WEB_SEARCH),
  webFetch: WebPolicySchema.default(DEFAULT_WEB_FETCH),
});
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

/** 完整默认安全配置（security 未声明或需兜底时使用）。 */
export const defaultSecurityConfig = SecurityConfigSchema.parse({});

// ============ guardrails ============

/**
 * 声明式 guardrail 规则（安全拦截，独立于上下文规则 `rules`）：
 * - `denyTools` 黑名单：命中工具语义名即阻断；
 * - `allowTools` 白名单：非空时仅允许名单内工具；
 * - `denyPatterns` 正则黑名单：命中工具入参（beforeToolCall）或结果（afterToolCall）即阻断。
 * 判定优先级：deny → allow → pattern；缺省全部空 = 放行。
 */
export const GuardrailRuleConfigSchema = z.object({
  id: z.string(),
  on: z.enum(['beforeToolCall', 'afterToolCall']).default('beforeToolCall'),
  allowTools: z.array(z.string()).default([]),
  denyTools: z.array(z.string()).default([]),
  denyPatterns: z.array(z.string()).default([]),
});
export type GuardrailRuleConfig = z.infer<typeof GuardrailRuleConfigSchema>;

export const GuardrailConfigSchema = z.array(GuardrailRuleConfigSchema).default([]);
export type GuardrailConfig = z.infer<typeof GuardrailConfigSchema>;

// ============ AgentConfig ============

export const AgentConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  version: z.string().optional(),
  model: ModelConfigSchema,
  systemPrompt: SystemPromptSchema,
  rules: z.array(RuleSchema).default([]),
  tools: ToolsConfigSchema.default(ToolsConfigSchema.parse({})),
  mcp: McpConfigSchema.optional(),
  skills: z.array(SkillRefSchema).default([]),
  memory: MemoryConfigSchema.optional(),
  cache: CacheConfigSchema.optional(),
  embedding: EmbeddingConfigSchema.optional(),
  documents: DocumentsConfigSchema.optional(),
  hooks: z.array(HookConfigSchema).default([]),
  plugins: z.array(z.string()).default([]),
  guardrails: GuardrailConfigSchema,
  orchestration: OrchestrationSchema.optional(),
  execution: ExecutionConfigSchema.optional(),
  security: SecurityConfigSchema.default(defaultSecurityConfig),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
