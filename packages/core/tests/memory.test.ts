import { describe, expect, it } from '@rstest/core';
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

  it('maxMessages 超限时按整轮边界淘汰', () => {
    const m = new ConversationMemory({ maxMessages: 3 });
    m.append([
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'u2' },
      { role: 'assistant', content: 'a2' },
    ]);

    // 裁剪点对齐到 user（轮次起点），丢弃完整的第一轮 [u1, a1]。
    expect(m.getMessages().map((x) => x.content)).toEqual(['u2', 'a2']);
  });

  it('裁剪不拆散 tool_call 与 tool 结果配对', () => {
    const m = new ConversationMemory({ maxMessages: 2 });
    m.append([
      { role: 'user', content: 'u1' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'c1', type: 'function', function: { name: 'f', arguments: '{}' } }],
      },
      { role: 'tool', content: 'r1', toolCallId: 'c1', name: 'f' },
      { role: 'assistant', content: 'a1f' },
    ]);

    const msgs = m.getMessages();
    // 不产生孤立 tool：宁可保留完整轮次（4 条），也不拆散配对留下 [tool, assistant]。
    expect(msgs.map((x) => x.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);
    for (let i = 0; i < msgs.length; i += 1) {
      if (msgs[i]?.role === 'tool') {
        expect(msgs[i - 1]?.role).toBe('assistant');
        expect(msgs[i - 1]?.toolCalls?.length).toBeGreaterThan(0);
      }
    }
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
