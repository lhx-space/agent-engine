import MiniSearch from 'minisearch';
import type { Rule } from '@lhx-agent-engine/config';
import type { ContextContributor } from '@lhx-agent-engine/core/context';
import type { EmbeddingProvider } from '@lhx-agent-engine/core/embedding';
import type { Plugin } from '@lhx-agent-engine/core/plugins';
import { hybridRetrieve, InMemoryVectorStore } from '@lhx-agent-engine/core/retrieval';
import type { VectorStore } from '@lhx-agent-engine/core/retrieval';

/** 中文分词（Node 内置 Intl.Segmenter，word 粒度，零依赖）。 */
function segment(text: string): string[] {
  const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
  return [...segmenter.segment(text)].map((s) => s.segment).filter((s) => s.trim() !== '');
}

/** plugin-rules 工厂选项。 */
export interface RulesPluginOptions {
  /** 语义召回 provider（缺省仅 BM25 词法检索）。 */
  embedding?: EmbeddingProvider;
  /** on-demand 规则召回 top-k（默认 5）。 */
  topK?: number;
}

/**
 * 把 `always` 规则（全量）+ 检索命中的 `on-demand` 规则（`onDemand`）去重拼接为
 * 「本次注入的规则文本」。纯函数，不内嵌检索。
 */
export function loadRulesText(rules: Rule[], onDemand: Rule[]): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const rule of [...rules.filter((rule) => rule.kind === 'always'), ...onDemand]) {
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);
    parts.push(rule.content);
  }
  return parts.join('\n\n');
}

/**
 * rules 自建索引：MiniSearch 词法召回（description + tags）+ 可选向量语义召回。
 * 索引构建归插件（D3），检索编排复用 core 的 `hybridRetrieve`（BM25 + 向量 RRF 唯一实现）。
 */
class RuleIndex {
  private readonly index: MiniSearch;
  private readonly records = new Map<string, Rule>();
  private readonly embedding: EmbeddingProvider | undefined;
  private readonly vectorStore: VectorStore | undefined;
  private vectorsBuilt = false;

  constructor(rules: Rule[], embedding?: EmbeddingProvider) {
    this.embedding = embedding;
    this.vectorStore = embedding ? new InMemoryVectorStore() : undefined;
    this.index = new MiniSearch({
      fields: ['description', 'tags'],
      tokenize: (text) => segment(text),
    });
    for (const rule of rules) {
      this.records.set(rule.id, rule);
      this.index.add({ id: rule.id, description: rule.description, tags: rule.tags.join(' ') });
    }
  }

  /** 检索命中的 on-demand 规则（含得分排序）；无 embedding 时纯 BM25。 */
  async retrieve(query: string, topK: number): Promise<Rule[]> {
    const lexical = (q: string, k: number) =>
      this.index
        .search(q)
        .slice(0, k)
        .map((result) => ({ id: String(result.id), score: result.score }));
    const ids =
      this.embedding && this.vectorStore
        ? await hybridRetrieve(query, topK, {
            embedding: this.embedding,
            vectorStore: this.vectorStore,
            lexical,
            ensureVectors: () => this.ensureVectors(),
          })
        : lexical(query, topK);
    return ids
      .map((candidate) => this.records.get(candidate.id))
      .filter((rule): rule is Rule => rule !== undefined);
  }

  /** 一次性把全部规则的 `description + tags` 向量化入库（惰性，只做一次）。 */
  private async ensureVectors(): Promise<void> {
    if (this.vectorsBuilt || !this.embedding || !this.vectorStore) return;
    this.vectorsBuilt = true;
    for (const rule of this.records.values()) {
      const [vector] = await this.embedding.embed([`${rule.description} ${rule.tags.join(' ')}`]);
      if (vector) await this.vectorStore.add([{ id: rule.id, vector }]);
    }
  }
}

/**
 * 创建 rules 上下文注入插件：注册一个 `ContextContributor`，每次 run 按 userInput
 * 检索（`always` 全注入 + `on-demand` BM25/向量 RRF 召回）并把规则文本注入 system prompt。
 * `config.rules` 字段的解释权移交本插件（D1-A：字段不变、零迁移）。
 */
export function createRulesPlugin(rules: Rule[], options: RulesPluginOptions = {}): Plugin {
  const topK = options.topK ?? 5;
  const index = rules.length > 0 ? new RuleIndex(rules, options.embedding) : undefined;

  const contributor: ContextContributor = {
    name: '@lhx-agent-engine/plugin-rules',
    async contribute({ userInput }) {
      if (!index) return undefined;
      const onDemand = await index.retrieve(userInput, topK);
      const text = loadRulesText(rules, onDemand);
      return text.length > 0 ? { text } : undefined;
    },
  };

  return {
    name: '@lhx-agent-engine/plugin-rules',
    description: '规则上下文注入（always + on-demand BM25/向量 RRF 检索）',
    version: '0.1.0',
    tags: ['rules', '规则', '上下文注入'],
    install(ctx) {
      ctx.registerContextContributor(contributor);
    },
  };
}
