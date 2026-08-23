import { describe, expect, it } from 'vitest';
import { ConversationMemory } from '../src/memory/conversation-memory';

describe('ConversationMemory', () => {
  it('追加 / 读取 / size / 清空', () => {
    const m = new ConversationMemory();
    m.push({ role: 'user', content: 'hi' });
    m.append([
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'again' },
    ]);

    expect(m.size).toBe(3);
    expect(m.getMessages().map((x) => x.content)).toEqual(['hi', 'hello', 'again']);

    m.clear();
    expect(m.size).toBe(0);
    expect(m.getMessages()).toEqual([]);
  });

  it('maxMessages 超限时保留最近 N 条', () => {
    const m = new ConversationMemory({ maxMessages: 3 });
    m.append([
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'u2' },
      { role: 'assistant', content: 'a2' },
    ]);

    expect(m.getMessages().map((x) => x.content)).toEqual(['a1', 'u2', 'a2']);
  });

  it('未设置 maxMessages 不裁剪', () => {
    const m = new ConversationMemory();
    for (let i = 0; i < 100; i += 1) {
      m.push({ role: 'user', content: String(i) });
    }
    expect(m.size).toBe(100);
  });

  it('maxMessages 非正数视为不裁剪', () => {
    const m = new ConversationMemory({ maxMessages: 0 });
    m.push({ role: 'user', content: 'hi' });
    expect(m.size).toBe(1);
  });

  it('getMessages 返回副本，外部修改不影响内部', () => {
    const m = new ConversationMemory();
    m.push({ role: 'user', content: 'hi' });

    const snapshot = m.getMessages();
    snapshot.push({ role: 'assistant', content: 'hacked' });

    expect(m.size).toBe(1);
    expect(m.getMessages().map((x) => x.content)).toEqual(['hi']);
  });
});
