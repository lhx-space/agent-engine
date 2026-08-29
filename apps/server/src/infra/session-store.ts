import type { AgentLoop } from '@lhx-agent-engine/core';

/** 一个已装配会话：常驻 AgentLoop + 资源释放 + 最近活跃时间戳。 */
export interface StoredSession {
  agent: AgentLoop;
  dispose: () => Promise<void>;
  lastActive: number;
}

export interface SessionStoreOptions {
  /** 空闲淘汰 TTL（毫秒），默认 30 分钟。 */
  ttlMs?: number;
  /** 会话数量上限（LRU 淘汰），默认 1000。 */
  maxSessions?: number;
}

/**
 * 会话存储后端接口（server 层，可插拔）：`sessionId → 已装配 Agent` 的保存 / 复用 / 淘汰。
 * 方法均为异步，承接 in-memory / redis 等实现；`delete` / `clear` 负责结束会话并释放资源。
 */
export interface SessionStoreBackend {
  get(id: string): Promise<StoredSession | undefined>;
  set(id: string, session: StoredSession): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_SESSIONS = 1000;

/**
 * 会话存储（in-memory）：`sessionId → 已装配 Agent` 复用，跨请求累积 memory。
 * 是 `SessionStoreBackend` 的默认实现；分布式后端（redis 等）实现同接口即可替换。
 */
export class InMemorySessionStore implements SessionStoreBackend {
  private readonly sessions = new Map<string, StoredSession>();
  private readonly ttlMs: number;
  private readonly maxSessions: number;

  constructor(options: SessionStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
  }

  get size(): number {
    return this.sessions.size;
  }

  /** 命中且未过期返回会话（刷新 lastActive）；过期则异步淘汰并返回 undefined。 */
  async get(id: string): Promise<StoredSession | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    if (Date.now() - session.lastActive > this.ttlMs) {
      await this.delete(id);
      return undefined;
    }
    session.lastActive = Date.now();
    return session;
  }

  async set(id: string, session: StoredSession): Promise<void> {
    this.evictExpired();
    if (this.sessions.size >= this.maxSessions && !this.sessions.has(id)) {
      this.evictOldest();
    }
    this.sessions.set(id, session);
  }

  /** 结束并释放会话（幂等）。 */
  async delete(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;
    this.sessions.delete(id);
    await session.agent.endSession();
    await session.dispose();
  }

  /** 结束并释放全部会话。 */
  async clear(): Promise<void> {
    const ids = [...this.sessions.keys()];
    await Promise.all(ids.map((id) => this.delete(id)));
  }

  private evictExpired(): void {
    const now = Date.now();
    const expired: string[] = [];
    for (const [id, session] of this.sessions) {
      if (now - session.lastActive > this.ttlMs) expired.push(id);
    }
    for (const id of expired) void this.delete(id);
  }

  private evictOldest(): void {
    let oldestId: string | undefined;
    let oldest = Infinity;
    for (const [id, session] of this.sessions) {
      if (session.lastActive < oldest) {
        oldest = session.lastActive;
        oldestId = id;
      }
    }
    if (oldestId !== undefined) void this.delete(oldestId);
  }
}
