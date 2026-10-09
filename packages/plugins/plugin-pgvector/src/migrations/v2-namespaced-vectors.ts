import type { Migration } from './types';

/**
 * v2：命名空间隔离 + 维度约束 + 原文列（存量库增量升级）。
 *
 * 「换 embedding 模型」是显式成本，不做静默兼容：存量向量维度与新维度不符时，
 * 迁移直接中止并给出清理指引，避免旧模型向量与新模型向量混检产生错误召回。
 *
 * 逆向 SQL（回滚用，手工执行；注意 `vector` 类型回退需先清理异维度数据）：
 *   DROP INDEX IF EXISTS idx_agent_vectors_scope;
 *   DROP INDEX IF EXISTS idx_agent_vectors_model;
 *   DROP INDEX IF EXISTS idx_agent_memory_ns;
 *   ALTER TABLE agent_vectors ALTER COLUMN vector TYPE vector;
 *   ALTER TABLE agent_vectors DROP COLUMN IF EXISTS namespace, DROP COLUMN IF EXISTS kind,
 *     DROP COLUMN IF EXISTS ref_id, DROP COLUMN IF EXISTS embedding_model,
 *     DROP COLUMN IF EXISTS dimension, DROP COLUMN IF EXISTS content, DROP COLUMN IF EXISTS created_at;
 *   ALTER TABLE agent_memory DROP COLUMN IF EXISTS namespace;
 */
export const v2NamespacedVectors: Migration = {
  version: 2,
  name: 'namespaced-vectors-with-dimension',
  async up(ctx) {
    const { vectorTable, memoryTable } = ctx.tables;

    await ctx.client.query(
      `ALTER TABLE ${vectorTable}
        ADD COLUMN IF NOT EXISTS namespace text NOT NULL DEFAULT 'default',
        ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'default',
        ADD COLUMN IF NOT EXISTS ref_id text,
        ADD COLUMN IF NOT EXISTS embedding_model text,
        ADD COLUMN IF NOT EXISTS dimension int,
        ADD COLUMN IF NOT EXISTS content text,
        ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`,
    );

    if (ctx.dimension !== undefined) {
      try {
        await ctx.client.query(
          `ALTER TABLE ${vectorTable} ALTER COLUMN vector TYPE vector(${ctx.dimension})`,
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(
          `plugin-pgvector: 无法将 ${vectorTable}.vector 收敛为 vector(${ctx.dimension})，` +
            `存量向量维度不符（${reason}）。请先清理旧模型写入的向量：` +
            `DELETE FROM ${vectorTable} WHERE embedding_model IS NOT NULL AND embedding_model <> 当前模型；` +
            `或删除全部向量后重试（DELETE FROM ${vectorTable};）。`,
        );
      }
    }

    await ctx.client.query(
      `CREATE INDEX IF NOT EXISTS idx_${vectorTable}_scope ON ${vectorTable} (namespace, kind)`,
    );
    await ctx.client.query(
      `CREATE INDEX IF NOT EXISTS idx_${vectorTable}_model ON ${vectorTable} (embedding_model)`,
    );

    await ctx.client.query(
      `ALTER TABLE ${memoryTable} ADD COLUMN IF NOT EXISTS namespace text NOT NULL DEFAULT 'default'`,
    );
    await ctx.client.query(
      `CREATE INDEX IF NOT EXISTS idx_${memoryTable}_ns ON ${memoryTable} (namespace, key)`,
    );
  },
};
