import type { Pool } from 'pg';
import type {
  ConversationMessage,
  ConversationSession,
  ConversationStore,
  ListMessagesOptions,
  ListSessionsOptions,
} from '@lhx-agent-engine/core';

/** 会话表 + 消息表名（与 `PgvectorTables` 的对应切片）。 */
export interface PgConversationTables {
  sessionTable: string;
  messageTable: string;
}

interface SessionRow {
  id: string;
  agent_name: string;
  user_id: string;
  title: string | null;
  status: string;
  message_count: number;
  meta: unknown;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  seq: number;
  role: string;
  content: string | null;
  tool_calls: unknown;
  tool_call_id: string | null;
  name: string | null;
  tokens: number | null;
  meta: unknown;
  created_at: string;
}

function toSession(row: SessionRow): ConversationSession {
  return {
    id: row.id,
    agentName: row.agent_name,
    userId: row.user_id,
    ...(row.title !== null ? { title: row.title } : {}),
    status: row.status === 'ended' ? 'ended' : 'active',
    messageCount: row.message_count,
    meta: (row.meta ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMessage(row: MessageRow): ConversationMessage {
  return {
    seq: row.seq,
    role: row.role as ConversationMessage['role'],
    ...(row.content !== null ? { content: row.content } : {}),
    ...(row.tool_calls ? { toolCalls: row.tool_calls } : {}),
    ...(row.tool_call_id ? { toolCallId: row.tool_call_id } : {}),
    ...(row.name ? { name: row.name } : {}),
    ...(row.tokens !== null ? { tokens: row.tokens } : {}),
    ...(row.meta ? { meta: row.meta as Record<string, unknown> } : {}),
    createdAt: row.created_at,
  };
}

/**
 * pg 对话历史后端：`agent_sessions` + `agent_messages`，按会话范围有序读写。
 *
 * `seq` 在插入时按当前最大值 +1 计算，`UNIQUE(session_id, seq)` 兜住并发冲突（显式报错而非覆盖）。
 */
export class PgConversationStore implements ConversationStore {
  readonly name = 'pg';

  constructor(
    private readonly pool: Pool,
    private readonly tables: PgConversationTables,
  ) {}

  async createSession(session: ConversationSession): Promise<ConversationSession> {
    const { rows } = await this.pool.query<SessionRow>(
      `INSERT INTO ${this.tables.sessionTable}
         (id, agent_name, user_id, title, status, meta)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         title = COALESCE(EXCLUDED.title, ${this.tables.sessionTable}.title),
         status = EXCLUDED.status,
         updated_at = now()
       RETURNING *`,
      [
        session.id,
        session.agentName ?? 'default',
        session.userId ?? 'default',
        session.title ?? null,
        session.status ?? 'active',
        JSON.stringify(session.meta ?? {}),
      ],
    );
    return toSession(rows[0]!);
  }

  async appendMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${this.tables.messageTable}
         (session_id, seq, role, content, tool_calls, tool_call_id, name, tokens, meta)
       VALUES (
         $1,
         (SELECT COALESCE(MAX(seq), 0) + 1 FROM ${this.tables.messageTable} WHERE session_id = $1),
         $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb
       )`,
      [
        sessionId,
        message.role,
        message.content ?? null,
        message.toolCalls ? JSON.stringify(message.toolCalls) : null,
        message.toolCallId ?? null,
        message.name ?? null,
        message.tokens ?? null,
        JSON.stringify(message.meta ?? {}),
      ],
    );
    await this.pool.query(
      `UPDATE ${this.tables.sessionTable}
       SET message_count = message_count + 1, updated_at = now()
       WHERE id = $1`,
      [sessionId],
    );
  }

  async listMessages(
    sessionId: string,
    options: ListMessagesOptions = {},
  ): Promise<ConversationMessage[]> {
    const conditions = ['session_id = $1'];
    const params: unknown[] = [sessionId];
    if (options.beforeSeq !== undefined) {
      params.push(options.beforeSeq);
      conditions.push(`seq < $${params.length}`);
    }
    const where = conditions.join(' AND ');
    const limit = options.limit ?? null;

    // 取最近 N 条仍按 seq 升序返回：内层按 seq 降序限量，外层再升序。
    const sql =
      limit === null
        ? `SELECT * FROM ${this.tables.messageTable} WHERE ${where} ORDER BY seq ASC`
        : `SELECT * FROM (
             SELECT * FROM ${this.tables.messageTable} WHERE ${where} ORDER BY seq DESC LIMIT $${params.length + 1}
           ) recent ORDER BY seq ASC`;

    const { rows } = await this.pool.query<MessageRow>(
      sql,
      limit === null ? params : [...params, limit],
    );
    return rows.map(toMessage);
  }

  async listSessions(options: ListSessionsOptions = {}): Promise<ConversationSession[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (options.agentName !== undefined) {
      params.push(options.agentName);
      conditions.push(`agent_name = $${params.length}`);
    }
    if (options.userId !== undefined) {
      params.push(options.userId);
      conditions.push(`user_id = $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(options.limit ?? 50);
    params.push(options.offset ?? 0);

    const { rows } = await this.pool.query<SessionRow>(
      `SELECT * FROM ${this.tables.sessionTable} ${where}
       ORDER BY updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows.map(toSession);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM ${this.tables.sessionTable} WHERE id = $1`, [
      sessionId,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async endSession(sessionId: string): Promise<void> {
    await this.pool.query(
      `UPDATE ${this.tables.sessionTable} SET status = 'ended', updated_at = now() WHERE id = $1`,
      [sessionId],
    );
  }
}
