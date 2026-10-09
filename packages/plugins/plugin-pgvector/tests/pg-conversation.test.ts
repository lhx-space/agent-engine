import { afterAll, describe, expect, it } from '@rstest/core';
import type { Pool } from 'pg';
import { PgConversationStore, createPgvectorPool } from '../src/index';

/**
 * 真实 pg 回归：仅在设置了 `DATABASE_URL` 时执行（本地有 agent-engine-pgvector 容器即可跑）。
 * 未设置时整体跳过，保证无数据库的 CI 也能通过。
 */
const databaseUrl = process.env.DATABASE_URL;
const describePg = databaseUrl ? describe : describe.skip;

describePg('PgConversationStore（真实 pg）', () => {
  let pool: Pool | undefined;
  let store: PgConversationStore | undefined;
  const createdSessionIds: string[] = [];

  async function ensure(): Promise<PgConversationStore> {
    if (!store) {
      const created = await createPgvectorPool({ namespace: 'pg-conversation-test' });
      pool = created.pool;
      store = new PgConversationStore(created.pool, {
        sessionTable: created.tables.sessionTable,
        messageTable: created.tables.messageTable,
      });
    }
    return store;
  }

  afterAll(async () => {
    const active = await ensure();
    for (const id of createdSessionIds) {
      await active.deleteSession(id);
    }
    await pool?.end();
  });

  it('写入并按 seq 升序读回', async () => {
    const active = await ensure();
    const sessionId = `pgc-${Date.now()}-1`;
    createdSessionIds.push(sessionId);

    await active.createSession({ id: sessionId, agentName: 'pg-conversation-test' });
    await active.appendMessage(sessionId, { role: 'user', content: '第一问' });
    await active.appendMessage(sessionId, { role: 'assistant', content: '第一答' });

    const messages = await active.listMessages(sessionId);
    expect(messages.map((message) => message.seq)).toEqual([1, 2]);
    expect(messages.map((message) => message.content)).toEqual(['第一问', '第一答']);
  });

  it('limit 取最近 N 条且仍按 seq 升序', async () => {
    const active = await ensure();
    const sessionId = `pgc-${Date.now()}-2`;
    createdSessionIds.push(sessionId);
    await active.createSession({ id: sessionId, agentName: 'pg-conversation-test' });
    await active.appendMessage(sessionId, { role: 'user', content: 'q1' });
    await active.appendMessage(sessionId, { role: 'assistant', content: 'a1' });
    await active.appendMessage(sessionId, { role: 'user', content: 'q2' });

    const messages = await active.listMessages(sessionId, { limit: 2 });
    expect(messages.map((message) => message.content)).toEqual(['a1', 'q2']);
  });

  it('工具调用结构化存取', async () => {
    const active = await ensure();
    const sessionId = `pgc-${Date.now()}-3`;
    createdSessionIds.push(sessionId);
    await active.createSession({ id: sessionId, agentName: 'pg-conversation-test' });
    await active.appendMessage(sessionId, {
      role: 'assistant',
      toolCalls: [{ id: 'call_1', type: 'function', function: { name: 'get_weather' } }],
    });

    const [message] = await active.listMessages(sessionId);
    expect(message?.toolCalls).toEqual([
      { id: 'call_1', type: 'function', function: { name: 'get_weather' } },
    ]);
  });

  it('按 agentName 列举，且 deleteSession 级联删除消息', async () => {
    const active = await ensure();
    const sessionId = `pgc-${Date.now()}-4`;
    createdSessionIds.push(sessionId);
    await active.createSession({ id: sessionId, agentName: 'pg-conversation-test' });
    await active.appendMessage(sessionId, { role: 'user', content: 'hi' });

    const sessions = await active.listSessions({ agentName: 'pg-conversation-test' });
    expect(sessions.some((session) => session.id === sessionId)).toBe(true);

    expect(await active.deleteSession(sessionId)).toBe(true);
    expect(await active.listMessages(sessionId)).toEqual([]);
  });

  it('endSession 只改状态，消息保留', async () => {
    const active = await ensure();
    const sessionId = `pgc-${Date.now()}-5`;
    createdSessionIds.push(sessionId);
    await active.createSession({ id: sessionId, agentName: 'pg-conversation-test' });
    await active.appendMessage(sessionId, { role: 'user', content: 'hi' });
    await active.endSession(sessionId);

    const [session] = await active.listSessions({ agentName: 'pg-conversation-test' });
    expect(session?.status).toBe('ended');
    expect((await active.listMessages(sessionId)).length).toBe(1);
  });
});
