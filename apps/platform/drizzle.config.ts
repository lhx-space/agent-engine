import { defineConfig } from 'drizzle-kit';

/**
 * 平台侧迁移配置：只管理 `platform` schema。
 * 引擎侧（`engine` schema）由 `plugin-pgvector` 的自建迁移负责，两者互不越界。
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['platform'],
  dbCredentials: {
    url: process.env.PLATFORM_DATABASE_URL ?? process.env.DATABASE_URL ?? '',
  },
});
