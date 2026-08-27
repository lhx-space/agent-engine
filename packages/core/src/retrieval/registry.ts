import MiniSearch from 'minisearch';
import type { EmbeddingProvider } from '../embedding/embedding';
import { hybridRetrieve } from './hybrid-retriever';
import type { RankedCandidate } from './rrf';
import type { CapabilityHit, CapabilityMeta, CapabilityType } from './types';
import { InMemoryVectorStore } from './vector-store';
import type { VectorStore } from './vector-store';

/** 中文分词（Node 内置 Intl.Segmenter，word 粒度，零依赖）。 */
export function segment(text: string): string[] {
  const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
  return [...segmenter.segment(text)].map((s) => s.segment).filter((s) => s.trim() !== '');
}

export interface CapabilityRegistryOptions {
  /** 语义召回的向量化 provider；缺省时仅 BM25 词法检索。 */
  embedding?: EmbeddingProvider;
  /** 语义召回的向量库；缺省且提供 `embedding` 时内部建 `InMemoryVectorStore`。 */
  vectorStore?: VectorStore;
}

/** 统一能力注册表：注册 meta，检索召回 top-k（含得分）；提供 `embedding` 时融合向量语义召回（RRF）。 */
export class CapabilityRegistry {
  private readonly metas = new Map<string, CapabilityMeta>();
  private readonly index: MiniSearch;
  private readonly embedding: EmbeddingProvider | undefined;
  private readonly vectorStore: VectorStore | undefined;
  private vectorsBuilt = false;

  constructor(options: CapabilityRegistryOptions = {}) {
    this.embedding = options.embedding;
    this.vectorStore =
      options.vectorStore ?? (options.embedding ? new InMemoryVectorStore() : undefined);
    this.index = new MiniSearch({
      fields: ['description', 'tags'],
      tokenize: (text) => segment(text),
    });
  }

  /** 注册能力 meta。同 id 覆盖。 */
  register(meta: CapabilityMeta): void {
    this.metas.set(meta.id, meta);
    if (this.index.has(meta.id)) {
      this.index.discard(meta.id);
    }
    this.index.add({
      id: meta.id,
      description: meta.description,
      tags: meta.tags.join(' '),
    });
    // 新 meta 注册后需重建向量（惰性，下次 retrieve 触发）。
    this.vectorsBuilt = false;
  }

  /** 检索 top-k 候选（含得分）：无 embedding 为 BM25；有 embedding 为 BM25 + 向量 RRF 融合。 */
  async retrieve(query: string, topK: number): Promise<CapabilityHit[]> {
    if (!this.embedding || !this.vectorStore) {
      return this.toHits(this.lexicalCandidates(query, topK));
    }
    const fused = await hybridRetrieve(query, topK, {
      embedding: this.embedding,
      vectorStore: this.vectorStore,
      lexical: (q, k) => this.lexicalCandidates(q, k),
      ensureVectors: () => this.ensureVectors(),
    });
    return this.toHits(fused);
  }

  /** 按类型列出已注册 meta。 */
  listByType(type: CapabilityType): CapabilityMeta[] {
    return [...this.metas.values()].filter((meta) => meta.type === type);
  }

  private lexicalCandidates(query: string, topK: number): RankedCandidate[] {
    return this.index
      .search(query)
      .slice(0, topK)
      .map((result) => ({ id: String(result.id), score: result.score }));
  }

  /** 一次性把所有 meta 的 `description + tags` 向量化入库（惰性，只做一次）。 */
  private async ensureVectors(): Promise<void> {
    if (this.vectorsBuilt || !this.embedding || !this.vectorStore) return;
    this.vectorsBuilt = true;
    for (const meta of this.metas.values()) {
      const [vector] = await this.embedding.embed([this.embedText(meta)]);
      if (vector) await this.vectorStore.add([{ id: meta.id, vector }]);
    }
  }

  private embedText(meta: CapabilityMeta): string {
    return `${meta.description} ${meta.tags.join(' ')}`;
  }

  private toHits(candidates: readonly RankedCandidate[]): CapabilityHit[] {
    const hits: CapabilityHit[] = [];
    for (const candidate of candidates) {
      const meta = this.metas.get(candidate.id);
      if (meta) hits.push({ meta, score: candidate.score });
    }
    return hits;
  }
}
