import type { RetrievalCandidate } from './retriever';

/**
 * 重排策略抽象：对检索候选重排序（可调分/过滤）。
 * 未来接 cross-encoder / LLM reranker；默认恒等（保持检索器原序原分）。
 */
export interface Reranker {
  readonly name: string;
  rerank(query: string, candidates: RetrievalCandidate[]): Promise<RetrievalCandidate[]>;
}

/** 开发默认：原样返回（保持 BM25 分数与顺序）。 */
export class IdentityReranker implements Reranker {
  readonly name = 'identity';
  async rerank(_query: string, candidates: RetrievalCandidate[]): Promise<RetrievalCandidate[]> {
    return candidates;
  }
}
