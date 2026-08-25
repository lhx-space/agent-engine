import type { Rule } from '@agent-engine/config';
import type { CacheBackend } from '../cache/cache-backend';
import type { ContextCompactor } from '../context/compactor';
import type { TokenCounter } from '../context/token-counter';
import type { EmbeddingProvider } from '../embedding/embedding';
import type { Hook } from '../hooks/types';
import type { MemoryBackend } from '../memory/memory-backend';
import type { Reranker } from '../retrieval/reranker';
import type { Retriever } from '../retrieval/retriever';
import type { VectorStore } from '../retrieval/vector-store';
import type { GuardrailRule } from '../rules/types';
import type { Skill } from '../skills/types';
import type { Tool } from '../tools/types';

/**
 * 能力束：任何能力来源（plugin / mcp / builtin / config）统一产出的形状，
 * 供装配层单一 `mergeBundles` 汇聚进 AgentLoop 的 sinks。
 *
 * `dispose` 用于释放来源持有的资源（如 MCP 连接）；plugin 无 uninstall 时可省略。
 */
export interface CapabilityBundle {
  tools: Tool[];
  skills: Skill[];
  hooks: Hook[];
  rules: Rule[];
  guardrails: GuardrailRule[];
  promptFragments: string[];
  memoryBackends: MemoryBackend[];
  cacheBackends: CacheBackend[];
  vectorStores: VectorStore[];
  embeddingProviders: EmbeddingProvider[];
  tokenCounters: TokenCounter[];
  contextCompactors: ContextCompactor[];
  retrievers: Retriever[];
  rerankers: Reranker[];
  /** 释放来源持有的资源（幂等）。 */
  dispose?: () => Promise<void>;
}
