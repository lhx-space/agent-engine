import { Pool } from 'pg';

/** plugin-pgvector 的连接配置。 */
export interface PgvectorConfig {
  /** 连接串；缺省读 `DATABASE_URL` 环境变量。 */
  connectionString?: string;
  /** 向量表名，默认 `agent_vectors`。 */
  vectorTable?: string;
  /** 记忆 KV 表名，默认 `agent_memory`。 */
  memoryTable?: string;
}

export interface PgvectorTables {
  vectorTable: string;
  memoryTable: string;
}

/** 表名白名单校验（本地受信配置，但仍防御 SQL 注入）。 */
function assertTableName(name: string): void {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`plugin-pgvector: 非法表名 "${name}"`);
  }
}

/** 创建 pg 连接池，并确保 pgvector 扩展与两张表就绪（幂等）。 */
export async function createPgvectorPool(
  config: PgvectorConfig = {},
): Promise<{ pool: Pool; tables: PgvectorTables }> {
  const connectionString = config.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('plugin-pgvector: 需要 connectionString 或 DATABASE_URL');
  }

  const vectorTable = config.vectorTable ?? 'agent_vectors';
  const memoryTable = config.memoryTable ?? 'agent_memory';
  assertTableName(vectorTable);
  assertTableName(memoryTable);

  const pool = new Pool({ connectionString });

  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${vectorTable} (
        id text PRIMARY KEY,
        vector vector NOT NULL,
        metadata jsonb
      )`,
    );
    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${memoryTable} (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
    );
  } catch (error) {
    await pool.end().catch(() => {});
    throw error;
  }

  return { pool, tables: { vectorTable, memoryTable } };
}
