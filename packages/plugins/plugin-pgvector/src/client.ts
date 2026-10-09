import { Pool } from 'pg';
import { applyMigrations } from './migrations';
import { assertTableName } from './tables';
import type { PgvectorTables } from './tables';

/** plugin-pgvector 的连接与存储配置。 */
export interface PgvectorConfig {
  /** 连接串；缺省读 `DATABASE_URL` 环境变量。 */
  connectionString?: string;
  /** 向量表名，默认 `agent_vectors`。 */
  vectorTable?: string;
  /** 记忆 KV 表名，默认 `agent_memory`。 */
  memoryTable?: string;
  /** 会话表名，默认 `agent_sessions`。 */
  sessionTable?: string;
  /** 消息表名，默认 `agent_messages`。 */
  messageTable?: string;
  /** 向量维度；由装配层取 `config.embedding.dimension` 注入。未配置则建不定长 `vector` 列。 */
  dimension?: number;
  /** 命名空间（装配层按 agent 注入），用于多 agent 共用一库时隔离数据。 */
  namespace?: string;
  /** embedding 模型标识（取自 `EmbeddingProvider.name`），写入向量时记录，供跨模型隔离。 */
  embeddingModel?: string;
}

export type { PgvectorTables };

/**
 * 创建 pg 连接池，并经迁移机制确保扩展与表结构就绪（幂等、版本化）。
 *
 * 表结构变更一律走 `migrations/`，不再在此处写裸 DDL——否则存量库永远长不出新列。
 */
export async function createPgvectorPool(
  config: PgvectorConfig = {},
): Promise<{ pool: Pool; tables: PgvectorTables }> {
  const connectionString = config.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('plugin-pgvector: 需要 connectionString 或 DATABASE_URL');
  }

  const vectorTable = config.vectorTable ?? 'agent_vectors';
  const memoryTable = config.memoryTable ?? 'agent_memory';
  const sessionTable = config.sessionTable ?? 'agent_sessions';
  const messageTable = config.messageTable ?? 'agent_messages';
  for (const table of [vectorTable, memoryTable, sessionTable, messageTable]) {
    assertTableName(table);
  }

  const pool = new Pool({ connectionString });
  const tables: PgvectorTables = { vectorTable, memoryTable, sessionTable, messageTable };

  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    await applyMigrations(pool, tables, config.dimension);
  } catch (error) {
    await pool.end().catch(() => {});
    throw error;
  }

  return { pool, tables };
}
