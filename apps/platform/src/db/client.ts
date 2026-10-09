import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * 双连接池：代码按「可拆成两个库」设计，物理上先指向同一实例的不同 schema。
 *
 * - `platformDb`：业务库（市场 / 安装 / agent 实例），由 Drizzle 管理
 * - `enginePool`：引擎库（会话 / 向量 / 记忆），**只读**且只经 `plugin-pgvector` 的 store 访问
 *
 * 若要拆库，只需改 `PLATFORM_DATABASE_URL` 指向另一个实例，业务代码无需改动。
 */
let platformPool: Pool | undefined;
let platform: ReturnType<typeof drizzle<typeof schema>> | undefined;
let enginePool: Pool | undefined;

function requireUrl(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`apps/platform: 需要环境变量 ${name}`);
  }
  return value;
}

/** 平台库（Drizzle，platform schema）。 */
export function getPlatformDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!platform) {
    platformPool = new Pool({
      connectionString: requireUrl(
        process.env.PLATFORM_DATABASE_URL ?? process.env.DATABASE_URL,
        'PLATFORM_DATABASE_URL 或 DATABASE_URL',
      ),
    });
    platform = drizzle(platformPool, { schema });
  }
  return platform;
}

/** 引擎库（原生 pg，engine schema；仅用于读取会话历史等只读场景）。 */
export function getEnginePool(): Pool {
  if (!enginePool) {
    enginePool = new Pool({
      connectionString: requireUrl(
        process.env.ENGINE_DATABASE_URL ?? process.env.DATABASE_URL,
        'ENGINE_DATABASE_URL 或 DATABASE_URL',
      ),
    });
  }
  return enginePool;
}

/** 释放两侧连接（脚本用；Next 路由进程常驻不调用）。 */
export async function closeDb(): Promise<void> {
  await platformPool?.end();
  await enginePool?.end();
  platformPool = undefined;
  platform = undefined;
  enginePool = undefined;
}
