import { z } from 'zod';

// ============ model ============

export const ModelProviderSchema = z.enum(['openai-compatible', 'anthropic', 'custom']);
export type ModelProvider = z.infer<typeof ModelProviderSchema>;

export const ModelConfigSchema = z.object({
  provider: ModelProviderSchema.default('openai-compatible'),
  baseURL: z.string().optional(),
  model: z.string(),
  temperature: z.number().optional(),
  maxTokens: z.number().int().positive().optional(),
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
  'beforeLLM',
  'afterLLM',
  'beforeToolCall',
  'afterToolCall',
  'onStepEnd',
  'onSessionEnd',
  'onError',
]);
export type HookPoint = z.infer<typeof HookPointSchema>;

export const StaticRuleSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  kind: z.literal('static'),
});
export type StaticRule = z.infer<typeof StaticRuleSchema>;

export const GuardrailRuleSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  kind: z.literal('guardrail'),
  on: HookPointSchema,
});
export type GuardrailRule = z.infer<typeof GuardrailRuleSchema>;

export const RuleSchema = z.discriminatedUnion('kind', [StaticRuleSchema, GuardrailRuleSchema]);
export type Rule = z.infer<typeof RuleSchema>;

export const HookConfigSchema = z.object({
  plugin: z.string(),
  on: z.array(HookPointSchema),
});
export type HookConfig = z.infer<typeof HookConfigSchema>;

// ============ tools / skills / mcp ============

export const ToolRefSchema = z.object({
  use: z.string(),
});
export type ToolRef = z.infer<typeof ToolRefSchema>;

export const SkillRefSchema = z.object({
  path: z.string(),
});
export type SkillRef = z.infer<typeof SkillRefSchema>;

export const McpServerSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
});
export type McpServer = z.infer<typeof McpServerSchema>;

export const McpConfigSchema = z.object({
  servers: z.array(McpServerSchema).default([]),
});
export type McpConfig = z.infer<typeof McpConfigSchema>;

// ============ memory ============

export const SessionMemorySchema = z.object({
  maxMessages: z.number().int().positive().optional(),
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

// ============ orchestration ============

export const OrchestrationModeSchema = z.enum(['single', 'sequential', 'parallel', 'graph']);
export type OrchestrationMode = z.infer<typeof OrchestrationModeSchema>;

export const OrchestrationSchema = z.object({
  mode: OrchestrationModeSchema.default('single'),
});
export type Orchestration = z.infer<typeof OrchestrationSchema>;

// ============ AgentConfig ============

export const AgentConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  version: z.string().optional(),
  model: ModelConfigSchema,
  systemPrompt: SystemPromptSchema,
  rules: z.array(RuleSchema).default([]),
  tools: z.array(ToolRefSchema).default([]),
  mcp: McpConfigSchema.optional(),
  skills: z.array(SkillRefSchema).default([]),
  memory: MemoryConfigSchema.optional(),
  hooks: z.array(HookConfigSchema).default([]),
  plugins: z.array(z.string()).default([]),
  orchestration: OrchestrationSchema.optional(),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
