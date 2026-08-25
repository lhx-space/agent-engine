import type { AgentLoop } from '../agent/loop';
import type { CacheBackend } from '../cache/cache-backend';
import type { EmbeddingProvider } from '../embedding/embedding';
import type { ProviderFactory } from '../llm/provider';
import type { MemoryBackend } from '../memory/memory-backend';
import type { Plugin } from '../plugins/types';
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
  dispose(): Promise<void>;
}
