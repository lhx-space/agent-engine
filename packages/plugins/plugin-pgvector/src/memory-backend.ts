import type { Pool } from 'pg';
import type { MemoryBackend } from '@lhx-agent-engine/core';

/** 长期记忆 KV 持久化（pg jsonb 表）。 */
export class PgMemoryBackend implements MemoryBackend {
  readonly name = 'pg';

  constructor(
    private readonly pool: Pool,
    private readonly table: string,
  ) {}

  async get(key: string): Promise<unknown> {
    const result = await this.pool.query(`SELECT value FROM ${this.table} WHERE key = $1`, [key]);
    return result.rows[0]?.value;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${this.table} (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, JSON.stringify(value)],
    );
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM ${this.table} WHERE key = $1`, [key]);
    return (result.rowCount ?? 0) > 0;
  }

  async keys(prefix = ''): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT key FROM ${this.table} WHERE key LIKE $1 ORDER BY key`,
      [`${prefix}%`],
    );
    return result.rows.map((row: { key: string }) => row.key);
  }

  async clear(): Promise<void> {
    await this.pool.query(`TRUNCATE ${this.table}`);
  }
}
