// 对外核心类型出口（集中 re-export）。
export * from './types';

// 值导出。
export { createProvider } from './llm/provider';
export type { ProviderFactory } from './llm/provider';
export { AbortError, CompletionError } from './llm/types';
export { createOpenAIProvider } from './llm/openai';
export { createAnthropicProvider } from './llm/anthropic';
export { extractStructured } from './structured-output';
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
export { resolveMcpServer, resolveMcpServers } from './capability-source';
export type { ResolvedMcpServer } from './capability-source';
export { resolveAgentConfig } from './resolve';
export { HookPipeline } from './hooks/pipeline';
export type { Hook, HookPoint, HookTrace } from './hooks/types';
export { CapabilityRegistry } from './retrieval/registry';
export { CapabilityLoader } from './retrieval/loader';
export { renderTemplate, buildSystemPrompt, ContextComposer } from './context';
export { ApproximateTokenCounter, TokenBudgetCompactor } from './context';
export type {
  TokenCounter,
  ContextCompactor,
  ComposeContextInput,
  ComposeContextResult,
  ContextContributor,
  ContextContribution,
  ContextContributeInput,
} from './context';
export { Bm25Retriever, IdentityReranker, reciprocalRankFusion, hybridRetrieve } from './retrieval';
export type {
  Retriever,
  RetrievalCandidate,
  Reranker,
  RankedCandidate,
  HybridRetrieveOptions,
} from './retrieval';
export {
  ConversationMemory,
  InMemoryMemoryBackend,
  LLMSummarizer,
  noopLongTermMemory,
} from './memory';
export type { MemoryBackend, Summarizer, LongTermMemory } from './memory';
export { InMemoryCacheBackend } from './cache';
export type { CacheBackend } from './cache';
export { InMemoryVectorStore } from './retrieval/vector-store';
export type { VectorStore, VectorRecord, VectorMatch } from './retrieval/vector-store';
export type { EmbeddingProvider } from './embedding/embedding';
export { createEmbeddingProvider } from './embedding/openai';
export { EventBus } from './events';
export type { AgentEngineEvent, EventListener } from './events';
export { PluginManager } from './plugins';
export { AgentLoop } from './agent/loop';
export { assembleAgentLoop } from './agent/assemble';
export type { AssembleAgentLoopOptions } from './agent/assemble';
export type { AgentRunEvent, AgentRunOptions, AgentLoopResult } from './agent/types';
