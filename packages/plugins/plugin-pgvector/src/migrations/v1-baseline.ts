import type { Migration } from './types';

/**
 * v1 基线：向量表 + 记忆 KV 表（新库一次性建成目标形态）。
 *
 * 逆向 SQL（回滚用，手工执行）：
 *   DROP TABLE IF EXISTS agent_vectors;
 *   DROP TABLE IF EXISTS agent_memory;
 */
export const v1Baseline: Migration = {
  version: 1,
  name: 'baseline-vectors-and-memory',
  async up(ctx) {
    const vectorType = ctx.dimension ? `vector(${ctx.dimension})` : 'vector';
    await ctx.client.query(
      `CREATE TABLE IF NOT EXISTS ${ctx.tables.vectorTable} (
        id text PRIMARY KEY,
        namespace text NOT NULL DEFAULT 'default',
        kind text NOT NULL DEFAULT 'default',
        ref_id text,
        embedding_model text,
        dimension int,
        vector ${vectorType} NOT NULL,
        content text,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await ctx.client.query(
      `CREATE TABLE IF NOT EXISTS ${ctx.tables.memoryTable} (
        key text PRIMARY KEY,
        namespace text NOT NULL DEFAULT 'default',
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
    );
  },
};
