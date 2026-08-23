export type CapabilityType = 'rule' | 'skill' | 'mcp-tool' | 'plugin';

/** 能力的统一 meta（注册进 CapabilityRegistry，供 BM25 检索）。 */
export interface CapabilityMeta {
  id: string;
  type: CapabilityType;
  /** 匹配面：BM25 检索的核心，要精准、不过短不过冗长。 */
  description: string;
  /** 同义词，缓解 BM25 词面匹配漏检。 */
  tags: string[];
}

/** 检索命中项，含相关性得分（用于可观测排查）。 */
export interface CapabilityHit {
  meta: CapabilityMeta;
  score: number;
}
