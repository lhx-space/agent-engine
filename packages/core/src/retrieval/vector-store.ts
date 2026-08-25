// ============ 类型 ============

/** 待入库的向量记录。 */
export interface VectorRecord {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

/** 向量召回命中项。 */
export interface VectorMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * 向量库：语义检索的后端抽象（长期记忆召回 / RRF 融合检索的地基）。
 * 生产后端（pgvector / lanceDB 等）由用户/生态实现本接口并经 `PluginContext.registerVectorStore` 接入。
 */
export interface VectorStore {
  readonly name: string;
  add(records: VectorRecord[]): Promise<void>;
  query(vector: number[], topK: number): Promise<VectorMatch[]>;
  delete(ids: string[]): Promise<number>;
  clear(): Promise<void>;
}

// ============ 支撑 ============

/** 余弦相似度（零向量退化为 0，避免除零）。 */
function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** 开发默认：进程内数组 + 暴力余弦相似度（O(n)，生产用 pgvector 等索引后端）。 */
export class InMemoryVectorStore implements VectorStore {
  readonly name = 'in-memory';
  private records: VectorRecord[] = [];

  async add(records: VectorRecord[]): Promise<void> {
    this.records.push(...records);
  }

  async query(vector: number[], topK: number): Promise<VectorMatch[]> {
    return this.records
      .map((record) => ({
        id: record.id,
        score: cosine(vector, record.vector),
        metadata: record.metadata,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async delete(ids: string[]): Promise<number> {
    const before = this.records.length;
    const idSet = new Set(ids);
    this.records = this.records.filter((record) => !idSet.has(record.id));
    return before - this.records.length;
  }

  async clear(): Promise<void> {
    this.records = [];
  }
}
