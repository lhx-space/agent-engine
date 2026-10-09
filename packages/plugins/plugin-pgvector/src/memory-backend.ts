import type { Pool } from 'pg';
import type { MemoryBackend } from '@lhx-agent-engine/core';

/** pg 长期记忆 KV 持久化，按命名空间隔离（多 agent 共用一库时互不可见）。 */
export class PgMemoryBackend implements MemoryBackend {
  readonly name = 'pg';

  constructor(
    private readonly pool: Pool,
    private readonly table: string,
    /** 命名空间（装配层按 agent 注入）。 */
    private readonly namespace: string = 'default',
  ) {}

  async get(key: string): Promise<unknown> {
    const result = await this.pool.query(
      `SELECT value FROM ${this.table} WHERE namespace = $1 AND key = $2`,
      [this.namespace, key],
    );
    return result.rows[0]?.value;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${this.table} (key, namespace, value) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, this.namespace, JSON.stringify(value)],
    );
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM ${this.table} WHERE namespace = $1 AND key = $2`,
      [this.namespace, key],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async keys(prefix = ''): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT key FROM ${this.table} WHERE namespace = $1 AND key LIKE $2 ORDER BY key`,
      [this.namespace, `${prefix}%`],
    );
    return result.rows.map((row: { key: string }) => row.key);
  }

  /** 只清理本命名空间（禁止 TRUNCATE 全表）。 */
  async clear(): Promise<void> {
    await this.pool.query(`DELETE FROM ${this.table} WHERE namespace = $1`, [this.namespace]);
  }
}
