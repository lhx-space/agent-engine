import type { AgentLoop } from '../agent/loop';
import type { CacheBackend } from '../cache/cache-backend';
import type { ContextCompactor } from '../context/compactor';
import type { TokenCounter } from '../context/token-counter';
import type { EmbeddingProvider } from '../embedding/embedding';
import type { EventBus } from '../events/event-bus';
import type { ProviderFactory } from '../llm/provider';
import type { MemoryBackend } from '../memory/memory-backend';
import type { Plugin } from '../plugins/types';
import type { Reranker } from '../retrieval/reranker';
import type { Retriever } from '../retrieval/retriever';
import type { VectorStore } from '../retrieval/vector-store';
import type { SandboxBackend } from '../sandbox/types';

/** plugin 工厂：`name → () => Plugin`（由 cli/server 注入，core 不反向依赖各 plugin 包）。 */
export type PluginFactory = () => Plugin | Promise<Plugin>;

/** `resolveAgentConfig` 的可注入依赖。 */
export interface ResolveDeps {
  /** plugin 名 → 工厂（`@agent-engine/plugin-git` → `() => createGitPlugin()`）。 */
  pluginFactories?: Record<string, PluginFactory>;
  /** 预置 LLM provider 工厂；缺省用 `createProvider`。 */
  providerFactory?: ProviderFactory;
  /** 预置沙箱后端（bash 启用时；缺省按 security.sandbox.backend 解析）。 */
  sandbox?: SandboxBackend;
}

/** 装配完成的 Agent：可 run 的循环 + 解析出的可插拔后端 + 释放资源（MCP 连接等）的 dispose。 */
export interface ResolvedAgent {
  agent: AgentLoop;
  /** 按 `memory.longTerm.backend` 解析出的长期记忆后端（默认 in-memory）。 */
  memoryBackend: MemoryBackend;
  /** 按 `cache.backend` 解析出的缓存后端（默认 in-memory）。 */
  cacheBackend: CacheBackend;
  /** 语义召回向量库（默认 in-memory；插件可注册自定义）。 */
  vectorStore: VectorStore;
  /** 语义召回 embedding 提供商（需真实向量模型，插件注册；缺省 undefined）。 */
  embeddingProvider?: EmbeddingProvider;
  /** 事件总线（模块业务事件发布/订阅，含 `custom` 逃生舱）。 */
  eventBus: EventBus;
  /** token 计数器（默认粗估；插件可注入精确 tokenizer）。 */
  tokenCounter: TokenCounter;
  /** 上下文裁剪器（默认 token 预算整轮淘汰；三层记忆②可替换）。 */
  contextCompactor: ContextCompactor;
  /** 检索器（默认 BM25；RRF/向量召回可插）。 */
  retriever: Retriever;
  /** 重排器（默认恒等；cross-encoder/LLM 重排可插）。 */
  reranker: Reranker;
  dispose(): Promise<void>;
}
