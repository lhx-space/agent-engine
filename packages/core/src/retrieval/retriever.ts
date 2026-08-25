import { CapabilityRegistry } from './registry';

/** 检索候选（统一形状：id + 得分 + 可选载荷，由调用方收窄 payload）。 */
export interface RetrievalCandidate {
  id: string;
  score: number;
  payload?: unknown;
}

/**
 * 检索策略抽象：按 query 召回 top-k 候选（含得分）。
 * 异步签名承接未来 embedding/向量召回与 RRF 融合；默认 BM25。
 */
export interface Retriever {
  readonly name: string;
  retrieve(query: string, topK: number): Promise<RetrievalCandidate[]>;
}

/** 开发默认：BM25 检索，复用 `CapabilityRegistry`（含中文分词 + 得分）。 */
export class Bm25Retriever implements Retriever {
  readonly name = 'bm25';

  constructor(private readonly registry: CapabilityRegistry) {}

  async retrieve(query: string, topK: number): Promise<RetrievalCandidate[]> {
    return this.registry.retrieve(query, topK).map((hit) => ({
      id: hit.meta.id,
      score: hit.score,
      payload: hit.meta,
    }));
  }
}
