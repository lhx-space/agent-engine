import { Redis } from 'ioredis';

/** plugin-redis 的连接配置。 */
export interface RedisConfig {
  /** 连接 URL；缺省读 `REDIS_URL`，再回退 `redis://localhost:6379`。 */
  url?: string;
  /** key 前缀（命名空间隔离），默认 `agent-engine:`。 */
  prefix?: string;
}

/** 创建 redis 连接。 */
export function createRedis(config: RedisConfig = {}): { redis: Redis; prefix: string } {
  const url = config.url ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
  const prefix = config.prefix ?? 'agent-engine:';
  return { redis: new Redis(url), prefix };
}
