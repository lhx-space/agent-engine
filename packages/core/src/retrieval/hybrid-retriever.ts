import type { EmbeddingProvider } from '../embedding/embedding';
import { reciprocalRankFusion } from './rrf';
import type { RankedCandidate } from './rrf';
import type { VectorStore } from './vector-store';

export interface HybridRetrieveOptions {
  /** 语义召回的向量化 provider。 */
  embedding: EmbeddingProvider;
  /** 语义召回的向量库。 */
  vectorStore: VectorStore;
  /** 词法（BM25）召回回调：按 query 返回按分数降序的候选（内部会按 `topK * 2` 超采）。 */
  lexical: (query: string, topK: number) => RankedCandidate[];
  /** 可选：确保索引已向量化（幂等）。缺省表示调用方已在上游（如 addChunks）完成向量化。 */
  ensureVectors?: () => Promise<void>;
}

/**
 * 统一混合检索原语：词法（BM25）+ 语义（向量）双路召回，RRF 融合，返回 top-k 候选。
 * 语义链路（embed / 向量查询 / 惰性向量化）任一步失败时优雅回落词法（best-effort）。
 * 这是能力检索与文档检索共用的唯一实现——索引构建归各模块，检索编排只此一份。
 */
export async function hybridRetrieve(
  query: string,
  topK: number,
  options: HybridRetrieveOptions,
): Promise<RankedCandidate[]> {
  const lexical = options.lexical(query, topK * 2);
  try {
    await options.ensureVectors?.();
    const [vector] = await options.embedding.embed([query]);
    if (!vector) return lexical.slice(0, topK);
    const matches = await options.vectorStore.query(vector, topK * 2);
    const semantic: RankedCandidate[] = matches.map((match) => ({
      id: match.id,
      score: match.score,
    }));
    return reciprocalRankFusion([lexical, semantic]).slice(0, topK);
  } catch {
    return lexical.slice(0, topK);
  }
}
