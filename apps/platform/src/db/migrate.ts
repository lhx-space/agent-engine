import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from './schema';

/** 应用 platform schema 的迁移（drizzle-kit generate 的产物）。 */
async function main(): Promise<void> {
  const url = process.env.PLATFORM_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('apps/platform: 需要 PLATFORM_DATABASE_URL 或 DATABASE_URL');
  }
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query('CREATE SCHEMA IF NOT EXISTS platform');
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('platform migrations applied');
  } finally {
    await pool.end();
  }
}

void main();
