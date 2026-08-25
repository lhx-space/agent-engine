/** 对外核心类型统一出口。 */

// llm
export type {
  ChatMessage,
  ChatRole,
  ChatCompletionParams,
  ChatCompletionResult,
  LLMProvider,
  TokenUsage,
  ToolCall,
  ToolDefinition,
} from './llm/types';
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
export type { WebSearchInput, WebSearchResult } from './tools/builtin/web-search';
export type { WebFetchInput, WebFetchResult } from './tools/builtin/web-fetch';
export type { DatetimeInput, DatetimeResult } from './tools/builtin/datetime';
// tools/utils
export type { TodoItem, TodoStatus } from './tools/utils/todo-store';
export type { FetchLike, HttpResponse } from './tools/utils/http';
export type { SearchProvider, SearchResult, SearchOptions } from './tools/utils/search';
export type { DomainPolicy } from './tools/utils/domain';
// sandbox
export type {
  SandboxBackend,
  SandboxBackendOptions,
  SandboxExecRequest,
  SandboxExecResult,
  SandboxResolution,
  ResolveSandboxDeps,
} from './sandbox/types';
// hooks
export type { Hook } from './hooks/types';
// rules
export type { GuardrailContext, GuardrailResult, GuardrailRule } from './rules/types';
// retrieval
export type { CapabilityHit, CapabilityMeta, CapabilityType } from './retrieval/types';
export type { CapabilityRecord, CapabilityRecordHit } from './retrieval/loader';
export type { VectorStore, VectorRecord, VectorMatch } from './retrieval/vector-store';
// embedding
export type { EmbeddingProvider } from './embedding/embedding';
// skills
export type { Skill } from './skills/types';
// capability
export type { CapabilityBundle } from './capability/types';
export type { MergedBundles } from './capability/bundle';
// plugins
export type { Plugin, PluginContext } from './plugins/types';
// mcp
export type { McpConnection, McpToolMeta, ConnectMcpServersResult } from './mcp';
// resolve
export type { ResolvedAgent, ResolveDeps, PluginFactory } from './resolve/types';
// memory
export type { ConversationMemoryOptions } from './memory/types';
export type { MemoryBackend } from './memory/memory-backend';
// cache
export type { CacheBackend } from './cache/cache-backend';
// context
export type { BuildSystemPromptOptions } from './context/types';
// agent
export type { AgentLoopOptions, AgentLoopResult, SystemPromptInput } from './agent/types';
