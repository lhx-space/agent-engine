import type { Rule } from '@agent-engine/config';
import type { CacheBackend } from '../cache/cache-backend';
import type { EmbeddingProvider } from '../embedding/embedding';
import type { Hook } from '../hooks/types';
import type { MemoryBackend } from '../memory/memory-backend';
import type { VectorStore } from '../retrieval/vector-store';
import type { Skill } from '../skills/types';
import type { Tool } from '../tools/types';

/**
 * 插件：最大的扩展单元，可打包多个 tools / skills / hooks / rules / prompt 片段，
 * 通过 `install(ctx)` 一次性注入能力。
 */
export interface Plugin {
  /** 唯一标识（如 `@agent-engine/plugin-otel`）。 */
  name: string;
  /** 匹配面：后续接入统一检索时的 meta description。 */
  description: string;
  /** 语义化版本。 */
  version: string;
  /** 同义词，后续接入统一检索时的 meta tags。 */
  tags?: string[];
  install(ctx: PluginContext): void | Promise<void>;
}

/** 插件与内核之间的能力注入桥梁。 */
export interface PluginContext {
  registerTool(tool: Tool): void;
  registerSkill(skill: Skill): void;
  registerHook(hook: Hook): void;
  registerRule(rule: Rule): void;
  provideSystemPrompt(fragment: string): void;
  /** 注册长期记忆后端（按 `memory.longTerm.backend` 名字选中）。 */
  registerMemoryBackend(backend: MemoryBackend): void;
  /** 注册缓存后端（按 `cache.backend` 名字选中）。 */
  registerCacheBackend(backend: CacheBackend): void;
  /** 注册向量库（语义召回；缺省回退 in-memory）。 */
  registerVectorStore(store: VectorStore): void;
  /** 注册 embedding 提供商（语义召回；缺省 undefined）。 */
  registerEmbeddingProvider(provider: EmbeddingProvider): void;
}
