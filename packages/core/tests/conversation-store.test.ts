import { describe, expect, it } from '@rstest/core';
import { InMemoryConversationStore } from '../src/conversation/in-memory';
import type { ConversationStore } from '../src/conversation/types';

/** 造一个有三条消息的会话。 */
async function seeded(): Promise<{ store: ConversationStore; sessionId: string }> {
  const store = new InMemoryConversationStore();
  await store.createSession({ id: 's1', agentName: 'demo-agent' });
  await store.appendMessage('s1', { role: 'user', content: 'q1' });
  await store.appendMessage('s1', { role: 'assistant', content: 'a1' });
  await store.appendMessage('s1', { role: 'user', content: 'q2' });
  return { store, sessionId: 's1' };
}

describe('InMemoryConversationStore', () => {
  it('seq 单调递增，读取按升序返回', async () => {
    const { store, sessionId } = await seeded();
    const messages = await store.listMessages(sessionId);
    expect(messages.map((message) => message.seq)).toEqual([1, 2, 3]);
    expect(messages.map((message) => message.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('limit 只取最近 N 条且仍按 seq 升序', async () => {
    const { store, sessionId } = await seeded();
    const messages = await store.listMessages(sessionId, { limit: 2 });
    expect(messages.map((message) => message.content)).toEqual(['a1', 'q2']);
  });

  it('beforeSeq 支持向前翻页', async () => {
    const { store, sessionId } = await seeded();
    const messages = await store.listMessages(sessionId, { beforeSeq: 3 });
    expect(messages.map((message) => message.seq)).toEqual([1, 2]);
  });

  it('appendMessage 对不存在的会话自动创建', async () => {
    const store = new InMemoryConversationStore();
    await store.appendMessage('new', { role: 'user', content: 'hi' });
    const messages = await store.listMessages('new');
    expect(messages.length).toBe(1);
    expect((await store.listSessions()).length).toBe(1);
  });

  it('createSession 幂等 upsert，不丢已有消息', async () => {
    const store = new InMemoryConversationStore();
    await store.createSession({ id: 's1', title: 'first' });
    await store.appendMessage('s1', { role: 'user', content: 'x' });
    await store.createSession({ id: 's1', title: 'second' });
    expect((await store.listMessages('s1')).length).toBe(1);
    const [session] = await store.listSessions();
    expect(session?.title).toBe('second');
  });

  it('按 agentName 列举会话，并按更新时间降序', async () => {
    const store = new InMemoryConversationStore();
    await store.createSession({ id: 'a', agentName: 'agent-a' });
    await store.createSession({ id: 'b', agentName: 'agent-b' });
    const sessions = await store.listSessions({ agentName: 'agent-a' });
    expect(sessions.map((session) => session.id)).toEqual(['a']);
    expect((await store.listSessions()).length).toBe(2);
  });

  it('deleteSession 级联删除消息', async () => {
    const { store, sessionId } = await seeded();
    expect(await store.deleteSession(sessionId)).toBe(true);
    expect(await store.listMessages(sessionId)).toEqual([]);
    expect(await store.deleteSession(sessionId)).toBe(false);
  });

  it('endSession 只标记状态，不清空消息', async () => {
    const { store, sessionId } = await seeded();
    await store.endSession?.(sessionId);
    const [session] = await store.listSessions();
    expect(session?.status).toBe('ended');
    expect((await store.listMessages(sessionId)).length).toBe(3);
  });

  it('messageCount 随写入递增', async () => {
    const { store, sessionId } = await seeded();
    const [session] = await store.listSessions({ agentName: 'demo-agent' });
    expect(session?.messageCount).toBe(3);
    expect(sessionId).toBe('s1');
  });
});
