import type { Migration } from './types';

/**
 * v3：会话与消息表（对话历史持久化）。
 *
 * `(session_id, seq)` 唯一约束保证同一会话内序号不重复——并发写同一会话时冲突会显式暴露，
 * 而不是静默覆盖已有消息。消息经 `session_id` 外键级联删除。
 *
 * 逆向 SQL（回滚用，手工执行）：
 *   DROP TABLE IF EXISTS agent_messages;
 *   DROP TABLE IF EXISTS agent_sessions;
 */
export const v3Conversations: Migration = {
  version: 3,
  name: 'conversation-sessions-and-messages',
  async up(ctx) {
    const { sessionTable, messageTable } = ctx.tables;

    await ctx.client.query(
      `CREATE TABLE IF NOT EXISTS ${sessionTable} (
        id text PRIMARY KEY,
        agent_name text NOT NULL DEFAULT 'default',
        user_id text NOT NULL DEFAULT 'default',
        title text,
        status text NOT NULL DEFAULT 'active',
        message_count int NOT NULL DEFAULT 0,
        meta jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await ctx.client.query(
      `CREATE INDEX IF NOT EXISTS idx_${sessionTable}_scope
       ON ${sessionTable} (agent_name, user_id, updated_at DESC)`,
    );

    await ctx.client.query(
      `CREATE TABLE IF NOT EXISTS ${messageTable} (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        session_id text NOT NULL REFERENCES ${sessionTable}(id) ON DELETE CASCADE,
        seq int NOT NULL,
        role text NOT NULL,
        content text,
        tool_calls jsonb,
        tool_call_id text,
        name text,
        tokens int,
        meta jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (session_id, seq)
      )`,
    );
    await ctx.client.query(
      `CREATE INDEX IF NOT EXISTS idx_${messageTable}_session
       ON ${messageTable} (session_id, seq)`,
    );
  },
};
