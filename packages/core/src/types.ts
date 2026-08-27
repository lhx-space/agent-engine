/** 对外核心类型统一出口。 */

// llm
export type {
  ChatMessage,
  ChatRole,
  ChatCompletionParams,
  ChatCompletionResult,
  FinishReason,
  LLMProvider,
  ResponseFormat,
  TokenUsage,
  ToolCall,
  ToolDefinition,
} from './llm/types';
// structured-output
export type { ExtractStructuredInput } from './structured-output/extract';
// tools
export type { Tool } from './tools/types';
export type { TodoInput, TodoResult } from './tools/builtin/todo';
export type {
  ReadFileInput,
  ReadFileResult,
  WriteFileInput,
  WriteFileResult,
  ListFilesInput,
  ListFilesResult,
  FileEntry,
} from './tools/file';
export type { BashInput } from './tools/bash';
export type { DatetimeInput, DatetimeResult } from './tools/builtin/datetime';
// tools/utils
export type { TodoItem, TodoStatus } from './tools/utils/todo-store';
export type { FetchLike, HttpResponse } from './tools/utils/http';
// sandbox
export type {
  SandboxBackend,
  SandboxBackendOptions,
  SandboxExecRequest,
  SandboxExecResult,
  SandboxResolution,
  ResolveSandboxDeps,
} from './sandbox/types';
export type {
  FunctionSandbox,
  FunctionSandboxExecRequest,
  FunctionSandboxExecResult,
} from './sandbox/function';
// hooks
export type { Hook } from './hooks/types';
// guardrails（协议：GuardrailRule 接口）
export type { GuardrailContext, GuardrailResult, GuardrailRule } from './guardrails';
// retrieval
export type { VectorStore, VectorRecord, VectorMatch } from './retrieval/vector-store';
export type { Retriever, RetrievalCandidate } from './retrieval/retriever';
export type { Reranker } from './retrieval/reranker';
export type { RankedCandidate } from './retrieval/rrf';
export type { HybridRetrieveOptions } from './retrieval/hybrid-retriever';
// embedding
export type { EmbeddingProvider } from './embedding/embedding';
// events
export type { AgentEngineEvent, EventListener } from './events/types';
// capability
export type { CapabilityBundle } from './capability/types';
export type { MergedBundles } from './capability/bundle';
// plugins
export type { Plugin, PluginContext } from './plugins/types';
// capability-source
export type { ToolSource } from './capability-source/types';
// resolve
export type { ResolvedAgent, ResolveDeps, PluginFactory } from './resolve/types';
// memory
export type { ConversationMemoryOptions } from './memory/types';
export type { MemoryBackend } from './memory/memory-backend';
export type { Summarizer } from './memory/summarizer';
export type { LongTermMemory } from './memory/long-term-memory';
// cache
export type { CacheBackend } from './cache/cache-backend';
// context
export type { BuildSystemPromptOptions } from './context/types';
export type { TokenCounter } from './context/token-counter';
export type { ContextCompactor } from './context/compactor';
export type {
  ContextContributeInput,
  ContextContribution,
  ContextContributor,
} from './context/context-contributor';
// agent
export type {
  AgentLoopOptions,
  AgentLoopResult,
  AgentRunOutcome,
  SystemPromptInput,
} from './agent/types';
