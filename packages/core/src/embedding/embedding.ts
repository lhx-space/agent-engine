/**
 * Embedding 抽象：把文本编码为等长向量，是长期记忆语义召回 / RRF 融合检索的地基。
 * 与 `LLMProvider` 平行、接口不同（文本→向量 vs 文本→文本），故独立成模块（AGENTS.md 7.3）。
 * 无内置默认（需真实向量模型），由用户/生态经 `PluginContext.registerEmbeddingProvider` 注入。
 */
export interface EmbeddingProvider {
  readonly name: string;
  /** 向量维度。 */
  readonly dimension: number;
  /** 把一批文本编码为等长向量（返回数组长度与入参一致，每项长度为 `dimension`）。 */
  embed(texts: string[]): Promise<number[][]>;
}
