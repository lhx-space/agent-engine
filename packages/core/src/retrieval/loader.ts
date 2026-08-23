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

/**
 * 统一能力加载器：把能力记录注册进 CapabilityRegistry（统一 meta），
 * 按 query BM25 检索，返回命中的记录（含 score）。
 *
 * 差异加载（如 rule 拼 content、skill 拼 instruction + 注册工具）由调用方处理。
 */
export class CapabilityLoader<T extends CapabilityRecord> {
  private readonly type: CapabilityType;
  private readonly registry: CapabilityRegistry;
  private readonly records: Map<string, T>;

  constructor(type: CapabilityType, records: T[], registry?: CapabilityRegistry) {
    this.type = type;
    this.registry = registry ?? new CapabilityRegistry();
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

  /** BM25 检索命中的记录（含 score），按 type 过滤。 */
  loadForQuery(query: string, topK = 5): CapabilityRecordHit<T>[] {
    const hits = this.registry.retrieve(query, topK);
    const result: CapabilityRecordHit<T>[] = [];
    for (const hit of hits) {
      if (hit.meta.type !== this.type) continue;
      const record = this.records.get(hit.meta.id);
      if (record) result.push({ record, score: hit.score });
    }
    return result;
  }
}
