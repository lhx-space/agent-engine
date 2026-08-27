// 对外核心类型出口（集中 re-export）。
export * from './types';

// 值导出。
export { createProvider } from './llm/provider';
export type { ProviderFactory } from './llm/provider';
export { AbortError, CompletionError } from './llm/types';
export { createOpenAIProvider } from './llm/openai';
export { createAnthropicProvider } from './llm/anthropic';
export { extractStructured } from './structured-output';
export {
  TextNormalizer,
  HtmlNormalizer,
  PdfNormalizer,
  DocxNormalizer,
  EpubNormalizer,
  FixedSizeChunker,
  MarkdownHeadingChunker,
  DocumentIndex,
  loadDocuments,
} from './documents';
export { ToolRegistry } from './tools/registry';
export {
  TodoStore,
  registerBuiltinTools,
  createTodoTool,
  createWebSearchTool,
  createWebFetchTool,
  createDatetimeTool,
  createDuckDuckGoSearchProvider,
  defaultFetch,
} from './tools/builtin';
export type { RegisterBuiltinToolsDeps } from './tools/builtin';
export { createReadFileTool, createWriteFileTool, createListFilesTool } from './tools/file';
export { createBashTool } from './tools/bash';
export {
  createDockerSandbox,
  createNsJailSandbox,
  resolveSandboxBackend,
  SandboxUnavailableError,
  WasiFunctionSandbox,
} from './sandbox';
export type {
  SandboxResolution,
  FunctionSandbox,
  FunctionSandboxExecRequest,
  FunctionSandboxExecResult,
} from './sandbox';
export { connectMcpServer, connectMcpServers, toTool, normalizeCallToolResult } from './mcp';
export type { McpConnection, McpToolMeta, ConnectMcpServersResult } from './mcp';
export { mergeBundles } from './capability';
export {
  resolveMcpServer,
  resolveMcpServers,
  resolveSkill,
  resolveSkills,
  createDefaultSkillSourceDeps,
} from './capability-source';
export type { ResolvedMcpServer, SkillSourceDeps, ResolvedSkill } from './capability-source';
export { resolveAgentConfig } from './resolve';
export { HookPipeline } from './hooks/pipeline';
export type { Hook, HookPoint, HookTrace } from './hooks/types';
export { RuleRegistry } from './rules/registry';
export { loadRulesText } from './rules/load';
export { compileGuardrails, createDeclarativeGuardrail } from './rules/declarative';
export { CapabilityRegistry } from './retrieval/registry';
export { CapabilityLoader } from './retrieval/loader';
export { renderTemplate, buildSystemPrompt, ContextComposer } from './context';
export { ApproximateTokenCounter, TokenBudgetCompactor } from './context';
export type {
  TokenCounter,
  ContextCompactor,
  ComposeContextInput,
  ComposeContextResult,
} from './context';
export { Bm25Retriever, IdentityReranker, reciprocalRankFusion, hybridRetrieve } from './retrieval';
export type {
  Retriever,
  RetrievalCandidate,
  Reranker,
  RankedCandidate,
  HybridRetrieveOptions,
} from './retrieval';
export { ConversationMemory, InMemoryMemoryBackend, LLMSummarizer, SemanticMemory } from './memory';
export type { MemoryBackend, Summarizer, LongTermMemory } from './memory';
export { InMemoryCacheBackend } from './cache';
export type { CacheBackend } from './cache';
export { InMemoryVectorStore } from './retrieval/vector-store';
export type { VectorStore, VectorRecord, VectorMatch } from './retrieval/vector-store';
export type { EmbeddingProvider } from './embedding/embedding';
export { createEmbeddingProvider } from './embedding/openai';
export { EventBus } from './events';
export type { AgentEngineEvent, EventListener } from './events';
export { loadSkillFromPath } from './skills';
export { PluginManager } from './plugins';
export { AgentLoop } from './agent/loop';
export { assembleAgentLoop } from './agent/assemble';
export type { AssembleAgentLoopOptions } from './agent/assemble';
export type { AgentRunEvent, AgentRunOptions, AgentLoopResult } from './agent/types';
