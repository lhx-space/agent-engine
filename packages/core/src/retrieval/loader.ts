import type { EmbeddingProvider } from '../embedding/embedding';
import type { VectorStore } from './vector-store';
import { CapabilityRegistry } from './registry';
import type { CapabilityType } from './types';

/** 可检索能力记录的公共字段约束。 */
export interface CapabilityRecord {
  id: string;
  description: string;
  tags: string[];
}

/** 能力记录命中项。 */
export interface CapabilityRecordHit<T> {
  record: T;
  score: number;
}

export interface CapabilityLoaderOptions {
  /** 共享注册表（缺省自建）；传入时忽略 `embedding`/`vectorStore`。 */
  registry?: CapabilityRegistry;
  /** 语义召回的向量化 provider；缺省时仅 BM25。 */
  embedding?: EmbeddingProvider;
  /** 语义召回的向量库；缺省且提供 `embedding` 时内部建 `InMemoryVectorStore`。 */
  vectorStore?: VectorStore;
}

/**
 * 统一能力加载器：把能力记录注册进 CapabilityRegistry（统一 meta），
 * 按 query 检索（BM25；提供 embedding 时 BM25 + 向量 RRF 融合），返回命中的记录（含 score）。
 *
 * 差异加载（如 rule 拼 content、skill 拼 instruction + 注册工具）由调用方处理。
 */
export class CapabilityLoader<T extends CapabilityRecord> {
  private readonly type: CapabilityType;
  private readonly registry: CapabilityRegistry;
  private readonly records: Map<string, T>;

  constructor(type: CapabilityType, records: T[], options: CapabilityLoaderOptions = {}) {
    this.type = type;
    this.registry =
      options.registry ??
      new CapabilityRegistry({ embedding: options.embedding, vectorStore: options.vectorStore });
    this.records = new Map<string, T>(records.map((record) => [record.id, record]));
    for (const record of records) {
      this.registry.register({
        id: record.id,
        type,
        description: record.description,
        tags: record.tags,
      });
    }
  }

  /** 检索命中的记录（含 score），按 type 过滤。 */
  async loadForQuery(query: string, topK = 5): Promise<CapabilityRecordHit<T>[]> {
    const hits = await this.registry.retrieve(query, topK);
    const result: CapabilityRecordHit<T>[] = [];
    for (const hit of hits) {
      if (hit.meta.type !== this.type) continue;
      const record = this.records.get(hit.meta.id);
      if (record) result.push({ record, score: hit.score });
    }
    return result;
  }
}
