import type { Pool } from 'pg';
import type {
  VectorMatch,
  VectorQueryFilter,
  VectorRecord,
  VectorStore,
} from '@lhx-agent-engine/core';

/** pgvector 后端的写入选项（由装配层注入，调用方无需感知）。 */
export interface PgVectorStoreOptions {
  /** 向量维度；提供时写入前校验，不符直接抛错（换模型宁可显式失败，也不静默污染）。 */
  dimension?: number;
  /** 默认命名空间；记录自带 `namespace` 时以记录为准。 */
  namespace?: string;
  /** 默认资产类型（memory / document / skill）。 */
  kind?: string;
  /** embedding 模型标识，写入 `embedding_model` 列，供跨模型隔离检索。 */
  embeddingModel?: string;
}

/** 把 JS 数值数组转成 pgvector 的 `vector` 字面量（如 `[0.1,0.2]`）。 */
function toVectorLiteral(vector: number[]): string {
  return JSON.stringify(vector);
}

/** pgvector 向量存储：向量 + 原文 + 命名空间落 pg，`<=>` 余弦距离检索（1 - 距离 = 相似度）。 */
export class PgVectorStore implements VectorStore {
  readonly name = 'pgvector';

  constructor(
    private readonly pool: Pool,
    private readonly table: string,
    private readonly options: PgVectorStoreOptions = {},
  ) {}

  async add(records: VectorRecord[]): Promise<void> {
    for (const record of records) {
      const expected = this.options.dimension;
      if (expected !== undefined && record.vector.length !== expected) {
        throw new Error(
          `plugin-pgvector: 向量维度不符，期望 ${expected}，实际 ${record.vector.length}` +
            `（id=${record.id}）。请确认 embedding 模型与 config.embedding.dimension 一致，` +
            `或清理旧模型向量后重建索引。`,
        );
      }
      await this.pool.query(
        `INSERT INTO ${this.table}
           (id, namespace, kind, ref_id, embedding_model, dimension, vector, content, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           namespace = EXCLUDED.namespace,
           kind = EXCLUDED.kind,
           ref_id = EXCLUDED.ref_id,
           embedding_model = EXCLUDED.embedding_model,
           dimension = EXCLUDED.dimension,
           vector = EXCLUDED.vector,
           content = EXCLUDED.content,
           metadata = EXCLUDED.metadata,
           created_at = now()`,
        [
          record.id,
          record.namespace ?? this.options.namespace ?? 'default',
          record.kind ?? this.options.kind ?? 'default',
          record.refId ?? null,
          this.options.embeddingModel ?? null,
          record.vector.length,
          toVectorLiteral(record.vector),
          record.content ?? null,
          record.metadata ?? null,
        ],
      );
    }
  }

  async query(vector: number[], topK: number, filter?: VectorQueryFilter): Promise<VectorMatch[]> {
    const conditions: string[] = [];
    const params: unknown[] = [toVectorLiteral(vector)];
    if (filter?.namespace !== undefined) {
      params.push(filter.namespace);
      conditions.push(`namespace = $${params.length}`);
    }
    if (filter?.kind !== undefined) {
      params.push(filter.kind);
      conditions.push(`kind = $${params.length}`);
    }
    params.push(topK);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.pool.query(
      `SELECT id, content, metadata, 1 - (vector <=> $1::vector) AS score
       FROM ${this.table}
       ${where}
       ORDER BY vector <=> $1::vector
       LIMIT $${params.length}`,
      params,
    );
    return result.rows.map(
      (row: { id: string; content: string | null; metadata: unknown; score: number }) => ({
        id: row.id,
        score: row.score,
        content: row.content ?? undefined,
        metadata: (row.metadata ?? undefined) as VectorMatch['metadata'],
      }),
    );
  }

  async delete(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.pool.query(`DELETE FROM ${this.table} WHERE id = ANY($1)`, [ids]);
    return result.rowCount ?? 0;
  }

  /** 只清理本命名空间的数据（禁止 TRUNCATE 全表，避免误删其他 agent）。 */
  async clear(): Promise<void> {
    await this.pool.query(`DELETE FROM ${this.table} WHERE namespace = $1`, [
      this.options.namespace ?? 'default',
    ]);
  }
}
