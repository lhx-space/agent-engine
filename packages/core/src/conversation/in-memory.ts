import { randomUUID } from 'node:crypto';
import type {
  ConversationMessage,
  ConversationSession,
  ConversationStore,
  ListMessagesOptions,
  ListSessionsOptions,
} from './types';

interface StoredSession extends ConversationSession {
  seq: number;
  messages: ConversationMessage[];
}

/**
 * 开发默认对话历史存储：进程内 Map，重启即失。
 * 生产后端（pg / redis 等）由插件实现同一接口并注册同名覆盖。
 */
export class InMemoryConversationStore implements ConversationStore {
  readonly name = 'in-memory';
  private readonly sessions = new Map<string, StoredSession>();

  async createSession(session: ConversationSession): Promise<ConversationSession> {
    const existing = this.sessions.get(session.id);
    if (existing) {
      const merged: StoredSession = { ...existing, ...session };
      this.sessions.set(session.id, merged);
      return this.publicView(merged);
    }
    const created: StoredSession = {
      ...session,
      status: session.status ?? 'active',
      messageCount: 0,
      seq: 0,
      messages: [],
      createdAt: session.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(session.id, created);
    return this.publicView(created);
  }

  async appendMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    let session = this.sessions.get(sessionId);
    if (!session) {
      await this.createSession({ id: sessionId });
      session = this.sessions.get(sessionId);
    }
    if (!session) return;
    session.seq += 1;
    session.messages.push({ ...message, seq: session.seq, createdAt: new Date().toISOString() });
    session.messageCount = session.messages.length;
    session.updatedAt = new Date().toISOString();
  }

  async listMessages(
    sessionId: string,
    options: ListMessagesOptions = {},
  ): Promise<ConversationMessage[]> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    let messages = session.messages;
    if (options.beforeSeq !== undefined) {
      messages = messages.filter((message) => (message.seq ?? 0) < options.beforeSeq!);
    }
    if (options.limit !== undefined && options.limit >= 0) {
      messages = messages.slice(Math.max(0, messages.length - options.limit));
    }
    return messages.map((message) => ({ ...message }));
  }

  async listSessions(options: ListSessionsOptions = {}): Promise<ConversationSession[]> {
    let sessions = [...this.sessions.values()];
    if (options.agentName !== undefined) {
      sessions = sessions.filter((session) => session.agentName === options.agentName);
    }
    if (options.userId !== undefined) {
      sessions = sessions.filter((session) => session.userId === options.userId);
    }
    sessions.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    const offset = options.offset ?? 0;
    const limit = options.limit ?? sessions.length;
    return sessions.slice(offset, offset + limit).map((session) => this.publicView(session));
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.status = 'ended';
    session.updatedAt = new Date().toISOString();
  }

  /** 供测试/宿主读取全部会话 id（非接口方法）。 */
  sessionIds(): string[] {
    return [...this.sessions.keys()];
  }

  private publicView(session: StoredSession): ConversationSession {
    const { seq: _seq, messages: _messages, ...rest } = session;
    return { ...rest };
  }
}

/** 生成会话 id（uuid v4，可安全出现在 URL 与日志）。 */
export function createSessionId(): string {
  return randomUUID();
}
