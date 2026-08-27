import type { Plugin } from '@agent-engine/core/plugins';
import { createRedis } from './client';
import type { RedisConfig } from './client';
import { RedisCacheBackend } from './cache-backend';

export { createRedis } from './client';
export type { RedisConfig } from './client';
export { RedisCacheBackend } from './cache-backend';

/**
 * Redis 插件：注册 Redis 缓存后端（TTL KV）。
 * config 侧 `cache.backend: 'redis'` 按名选中。
 * 会话状态持久化（`SessionStoreBackend`）放 server 层，见 AGENTS.md 15.4。
 */
export function createRedisPlugin(config: RedisConfig = {}): Plugin {
  return {
    name: '@agent-engine/plugin-redis',
    description: 'Redis 缓存后端（TTL KV）',
    version: '0.1.0',
    tags: ['redis', 'cache'],
    async install(ctx) {
      const { redis, prefix } = createRedis(config);
      ctx.registerCacheBackend(new RedisCacheBackend(redis, prefix));
      // 注：redis 连接常驻；后端 dispose 钩子见 AGENTS.md 15.4 配套点 2（待补）。
    },
  };
}
