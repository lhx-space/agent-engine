import { VERSION_TABLE } from '../tables';
import type { PgvectorTables } from '../tables';
import { v1Baseline } from './v1-baseline';
import { v3Conversations } from './v3-conversations';
import { v2NamespacedVectors } from './v2-namespaced-vectors';
import type { Migration, PoolLike } from './types';

export type { Migration, MigrationContext, PoolLike, Queryable } from './types';

/** 全部迁移，按版本号升序应用。 */
export const MIGRATIONS: readonly Migration[] = [
  v1Baseline,
  v2NamespacedVectors,
  v3Conversations,
].sort((a, b) => a.version - b.version);

interface AppliedRow {
  version: number;
}

/**
 * 应用未执行的迁移：建版本表 → 读已应用版本 → 逐条在自己的事务中执行 → 记录版本。
 *
 * 单条迁移失败即中止并回滚该条，错误含 `version` / `name` / 原因；
 * 绝不带着「半升级」的 schema 继续初始化。迁移只向前，回滚靠运维手工执行。
 */
export async function applyMigrations(
  pool: PoolLike,
  tables: PgvectorTables,
  dimension?: number,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${VERSION_TABLE} (
        version int PRIMARY KEY,
        name text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`,
    );
    const { rows } = (await client.query(`SELECT version FROM ${VERSION_TABLE}`)) as {
      rows: AppliedRow[];
    };
    const applied = new Set(rows.map((row) => row.version));

    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      try {
        await client.query('BEGIN');
        await migration.up({ client, tables, dimension });
        await client.query(`INSERT INTO ${VERSION_TABLE} (version, name) VALUES ($1, $2)`, [
          migration.version,
          migration.name,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(
          `plugin-pgvector: migration ${migration.version} (${migration.name}) failed: ${reason}`,
        );
      }
    }
  } finally {
    client.release();
  }
}
