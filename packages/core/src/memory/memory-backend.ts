// ============ 类型 ============

/**
 * 长期记忆后端：跨会话的 KV 持久化抽象。
 * 语义召回（向量检索）不属于本接口职责——那是 `VectorStore` + `EmbeddingProvider`（M3）。
 * 生产后端（pgvector 等）由用户/生态实现本接口并经 `PluginContext.registerMemoryBackend` 接入。
 */
export interface MemoryBackend {
  /** 后端名（`memory.longTerm.backend` 按名选择）。 */
  readonly name: string;
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  /** 列出所有 key（可按前缀过滤）。 */
  keys(prefix?: string): Promise<string[]>;
  clear(): Promise<void>;
}

/** 开发默认：进程内 Map 实现（随进程结束丢失；生产用 pgvector 等插件后端）。 */
export class InMemoryMemoryBackend implements MemoryBackend {
  readonly name = 'in-memory';
  private readonly store = new Map<string, unknown>();

  async get(key: string): Promise<unknown> {
    return this.store.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async keys(prefix = ''): Promise<string[]> {
    return [...this.store.keys()].filter((key) => key.startsWith(prefix));
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
