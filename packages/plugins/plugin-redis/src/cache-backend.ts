import type { Redis } from 'ioredis';
import type { CacheBackend } from '@lhx-agent-engine/core';

/** Redis 缓存后端：TTL KV（JSON 序列化，key 加命名空间前缀，clear 用 SCAN 删前缀）。 */
export class RedisCacheBackend implements CacheBackend {
  readonly name = 'redis';

  constructor(
    private readonly redis: Redis,
    private readonly prefix: string,
  ) {}

  private key(k: string): string {
    return this.prefix + k;
  }

  async get(key: string): Promise<unknown> {
    const raw = await this.redis.get(this.key(key));
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    const k = this.key(key);
    const raw = JSON.stringify(value);
    if (ttlMs !== undefined) {
      await this.redis.set(k, raw, 'PX', ttlMs);
    } else {
      await this.redis.set(k, raw);
    }
  }

  async delete(key: string): Promise<boolean> {
    return (await this.redis.del(this.key(key))) > 0;
  }

  async clear(): Promise<void> {
    const pattern = `${this.prefix}*`;
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}
