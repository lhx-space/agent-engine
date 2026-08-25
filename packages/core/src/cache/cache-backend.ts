// ============ 类型 ============

/**
 * 缓存后端：TTL KV 缓存抽象（LLM 响应、检索结果、会话状态等各层复用同一抽象）。
 * 生产后端（redis 等）由用户/生态实现本接口并经 `PluginContext.registerCacheBackend` 接入。
 */
export interface CacheBackend {
  readonly name: string;
  get(key: string): Promise<unknown>;
  /** 写入；`ttlMs` 为过期毫秒数，缺省不自动过期。 */
  set(key: string, value: unknown, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

interface CacheEntry {
  value: unknown;
  expiresAt?: number;
}

/** 开发默认：进程内 Map + 惰性 TTL（get 时判断过期并清理）。 */
export class InMemoryCacheBackend implements CacheBackend {
  readonly name = 'in-memory';
  private readonly store = new Map<string, CacheEntry>();

  async get(key: string): Promise<unknown> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlMs !== undefined ? Date.now() + ttlMs : undefined,
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
