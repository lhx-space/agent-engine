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
import type { Skill } from '../skills/types';
import type { Tool } from '../tools/types';
import type { CapabilityBundle } from './types';

/** `mergeBundles` 的输出：扁平化的能力列表 + 聚合 dispose。 */
export interface MergedBundles {
  tools: Tool[];
  skills: Skill[];
  hooks: Hook[];
  rules: Rule[];
  promptFragments: string[];
  memoryBackends: MemoryBackend[];
  cacheBackends: CacheBackend[];
  vectorStores: VectorStore[];
  embeddingProviders: EmbeddingProvider[];
  tokenCounters: TokenCounter[];
  contextCompactors: ContextCompactor[];
  retrievers: Retriever[];
  rerankers: Reranker[];
  /** 关闭所有 bundle 的资源（幂等）。 */
  dispose: () => Promise<void>;
}

/**
 * 把多个 `CapabilityBundle` 合并为扁平列表，并聚合各 bundle 的 `dispose`。
 * 这是「横向能力 → AgentLoop sinks」的单一汇聚点：新增能力来源只需产出 bundle，
 * 不触碰 loop / assemble。
 */
export function mergeBundles(bundles: CapabilityBundle[]): MergedBundles {
  const tools: Tool[] = [];
  const skills: Skill[] = [];
  const hooks: Hook[] = [];
  const rules: Rule[] = [];
  const promptFragments: string[] = [];
  const memoryBackends: MemoryBackend[] = [];
  const cacheBackends: CacheBackend[] = [];
  const vectorStores: VectorStore[] = [];
  const embeddingProviders: EmbeddingProvider[] = [];
  const tokenCounters: TokenCounter[] = [];
  const contextCompactors: ContextCompactor[] = [];
  const retrievers: Retriever[] = [];
  const rerankers: Reranker[] = [];
  const disposers: (() => Promise<void>)[] = [];

  for (const bundle of bundles) {
    tools.push(...bundle.tools);
    skills.push(...bundle.skills);
    hooks.push(...bundle.hooks);
    rules.push(...bundle.rules);
    promptFragments.push(...bundle.promptFragments);
    memoryBackends.push(...bundle.memoryBackends);
    cacheBackends.push(...bundle.cacheBackends);
    vectorStores.push(...bundle.vectorStores);
    embeddingProviders.push(...bundle.embeddingProviders);
    tokenCounters.push(...bundle.tokenCounters);
    contextCompactors.push(...bundle.contextCompactors);
    retrievers.push(...bundle.retrievers);
    rerankers.push(...bundle.rerankers);
    if (bundle.dispose) disposers.push(bundle.dispose);
  }

  return {
    tools,
    skills,
    hooks,
    rules,
    promptFragments,
    memoryBackends,
    cacheBackends,
    vectorStores,
    embeddingProviders,
    tokenCounters,
    contextCompactors,
    retrievers,
    rerankers,
    dispose: async () => {
      await Promise.all(disposers.map((dispose) => dispose()));
    },
  };
}
