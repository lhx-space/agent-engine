import type { Rule } from '@agent-engine/config';
import type { CacheBackend } from '../cache/cache-backend';
import type { ContextCompactor } from '../context/compactor';
import type { ContextContributor } from '../context/context-contributor';
import type { TokenCounter } from '../context/token-counter';
import type { EmbeddingProvider } from '../embedding/embedding';
import type { Hook } from '../hooks/types';
import type { MemoryBackend } from '../memory/memory-backend';
import type { Summarizer } from '../memory/summarizer';
import type { Reranker } from '../retrieval/reranker';
import type { Retriever } from '../retrieval/retriever';
import type { VectorStore } from '../retrieval/vector-store';
import type { GuardrailRule } from '../rules/types';
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
  /** 注册可执行 guardrail 规则（安全拦截，独立于上下文规则 `registerRule`）。 */
  registerGuardrail(rule: GuardrailRule): void;
  provideSystemPrompt(fragment: string): void;
  /** 注册长期记忆后端（按 `memory.longTerm.backend` 名字选中）。 */
  registerMemoryBackend(backend: MemoryBackend): void;
  /** 注册缓存后端（按 `cache.backend` 名字选中）。 */
  registerCacheBackend(backend: CacheBackend): void;
  /** 注册向量库（语义召回；缺省回退 in-memory）。 */
  registerVectorStore(store: VectorStore): void;
  /** 注册 embedding 提供商（语义召回；缺省 undefined）。 */
  registerEmbeddingProvider(provider: EmbeddingProvider): void;
  /** 注册 token 计数器（上下文预算；缺省粗估）。 */
  registerTokenCounter(counter: TokenCounter): void;
  /** 注册上下文裁剪器（三层记忆②；缺省 token 预算整轮淘汰）。 */
  registerContextCompactor(compactor: ContextCompactor): void;
  /** 注册检索器（缺省 BM25）。 */
  registerRetriever(retriever: Retriever): void;
  /** 注册重排器（缺省恒等）。 */
  registerReranker(reranker: Reranker): void;
  /** 注册滚动摘要策略（缺省 `LLMSummarizer`）。 */
  registerSummarizer(summarizer: Summarizer): void;
  /** 注册上下文贡献者（能力向 context 注入文本 + 临时工具的统一缝）。 */
  registerContextContributor(contributor: ContextContributor): void;
}
