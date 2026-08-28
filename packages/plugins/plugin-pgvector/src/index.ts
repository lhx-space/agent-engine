import type { Plugin } from '@lhx-agent-engine/core/plugins';
import { createPgvectorPool } from './client';
import type { PgvectorConfig } from './client';
import { PgMemoryBackend } from './memory-backend';
import { PgVectorStore } from './vector-store';

export { createPgvectorPool } from './client';
export type { PgvectorConfig, PgvectorTables } from './client';
export { PgVectorStore } from './vector-store';
export { PgMemoryBackend } from './memory-backend';

/**
 * pgvector 插件：注册 pgvector 向量存储 + 长期记忆 KV 持久化。
 *
 * 经 `PluginContext.registerVectorStore` / `registerMemoryBackend` 注入内核；
 * config 侧 `memory.longTerm.backend: 'pg'` 选中 KV 后端；向量后端取首个注册的 vectorStore
 * （多后端按名选择见 AGENTS.md 15.4 配套点 1）。
 */
export function createPgvectorPlugin(config: PgvectorConfig = {}): Plugin {
  return {
    name: '@lhx-agent-engine/plugin-pgvector',
    description: 'pgvector 向量存储 + 长期记忆 KV 持久化（PostgreSQL）',
    version: '0.1.0',
    tags: ['pgvector', 'postgresql', 'vector', 'memory'],
    async install(ctx) {
      const { pool, tables } = await createPgvectorPool(config);
      ctx.registerVectorStore(new PgVectorStore(pool, tables.vectorTable));
      ctx.registerMemoryBackend(new PgMemoryBackend(pool, tables.memoryTable));
      // 注：pool 常驻进程生命周期；后端 dispose 钩子见 AGENTS.md 15.4 配套点 2（待补）。
    },
  };
}
