/** 检索候选（统一形状：id + 得分 + 可选载荷，由调用方收窄 payload）。 */
export interface RetrievalCandidate {
  id: string;
  score: number;
  payload?: unknown;
}

/**
 * 检索策略抽象：按 query 召回 top-k 候选（含得分）。
 * 能力检索已由各 plugin 自建索引 + `hybridRetrieve` 完成；本接口供插件注入自定义检索策略。
 */
export interface Retriever {
  readonly name: string;
  retrieve(query: string, topK: number): Promise<RetrievalCandidate[]>;
}

/** 无检索策略的默认实现：返回空候选。 */
export const noopRetriever: Retriever = {
  name: 'none',
  retrieve: async () => [],
};
