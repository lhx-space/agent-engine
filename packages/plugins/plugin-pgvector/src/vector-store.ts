import type { Pool } from 'pg';
import type { VectorMatch, VectorRecord, VectorStore } from '@lhx-agent-engine/core';

/** 把 JS 数值数组转成 pgvector 的 `vector` 字面量（如 `[0.1,0.2]`）。 */
function toVectorLiteral(vector: number[]): string {
  return JSON.stringify(vector);
}

/** pgvector 向量存储：向量 + metadata 落 pg，`<=>` 余弦距离检索（1 - 距离 = 相似度）。 */
export class PgVectorStore implements VectorStore {
  readonly name = 'pgvector';

  constructor(
    private readonly pool: Pool,
    private readonly table: string,
  ) {}

  async add(records: VectorRecord[]): Promise<void> {
    for (const record of records) {
      await this.pool.query(
        `INSERT INTO ${this.table} (id, vector, metadata) VALUES ($1, $2::vector, $3)
         ON CONFLICT (id) DO UPDATE SET vector = EXCLUDED.vector, metadata = EXCLUDED.metadata`,
        [record.id, toVectorLiteral(record.vector), record.metadata ?? null],
      );
    }
  }

  async query(vector: number[], topK: number): Promise<VectorMatch[]> {
    const literal = toVectorLiteral(vector);
    const result = await this.pool.query(
      `SELECT id, metadata, 1 - (vector <=> $1::vector) AS score
       FROM ${this.table}
       ORDER BY vector <=> $1::vector
       LIMIT $2`,
      [literal, topK],
    );
    return result.rows.map((row: { id: string; metadata: unknown; score: number }) => ({
      id: row.id,
      score: row.score,
      metadata: (row.metadata ?? undefined) as VectorMatch['metadata'],
    }));
  }

  async delete(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.pool.query(`DELETE FROM ${this.table} WHERE id = ANY($1)`, [ids]);
    return result.rowCount ?? 0;
  }

  async clear(): Promise<void> {
    await this.pool.query(`TRUNCATE ${this.table}`);
  }
}
