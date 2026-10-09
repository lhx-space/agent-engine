import { describe, expect, it } from '@rstest/core';
import { AgentLoop } from '../src/agent/loop';
import { InMemoryConversationStore } from '../src/conversation/in-memory';
import type { ConversationStore } from '../src/conversation/types';
import { AbortError } from '../src/llm/types';
import type { ChatCompletionResult, LLMProvider } from '../src/llm/types';
import { ConversationMemory } from '../src/memory/conversation-memory';
import { ToolRegistry } from '../src/tools/registry';

function makeProvider(behavior: ChatCompletionResult | Error): LLMProvider {
  return {
    name: 'mock',
    async chatCompletion() {
      if (behavior instanceof Error) throw behavior;
      return behavior;
    },
  };
}

function ok(content: string): ChatCompletionResult {
  return { message: { role: 'assistant', content } };
}

function makeLoop(store: ConversationStore | undefined, provider: LLMProvider): AgentLoop {
  return new AgentLoop({
    provider,
    registry: new ToolRegistry(),
    systemPrompt: 'you are helpful',
    memory: new ConversationMemory(),
    ...(store ? { conversationStore: store } : {}),
    agentName: 'demo-agent',
  });
}

describe('AgentLoop 对话历史落盘', () => {
  it('正常结束：写入会话与消息，返回 sessionId', async () => {
    const store = new InMemoryConversationStore();
    const loop = makeLoop(store, makeProvider(ok('你好')));

    const result = await loop.run('hi');

    expect(result.sessionId).toBeTruthy();
    expect(result.persisted).toBe(true);
    const messages = await store.listMessages(result.sessionId);
    expect(messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(messages[0]?.content).toBe('hi');
    const [session] = await store.listSessions({ agentName: 'demo-agent' });
    expect(session?.agentName).toBe('demo-agent');
  });

  it('异常路径：已产生的消息同样落盘', async () => {
    const store = new InMemoryConversationStore();
    const loop = makeLoop(store, makeProvider(new Error('boom')));

    await expect(loop.run('hi')).rejects.toThrow('boom');

    const [session] = await store.listSessions({ agentName: 'demo-agent' });
    expect(session).toBeDefined();
    expect((await store.listMessages(session!.id)).map((message) => message.content)).toContain(
      'hi',
    );
  });

  it('中断路径：部分消息保留', async () => {
    const store = new InMemoryConversationStore();
    const loop = makeLoop(store, makeProvider(new AbortError()));

    await expect(loop.run('hi')).rejects.toBeInstanceOf(AbortError);

    const [session] = await store.listSessions({ agentName: 'demo-agent' });
    expect((await store.listMessages(session!.id)).length).toBeGreaterThan(0);
  });

  it('历史恢复：同一 sessionId 的新 loop 能读回上一轮', async () => {
    const store = new InMemoryConversationStore();
    const first = makeLoop(store, makeProvider(ok('第一轮回答')));
    const firstResult = await first.run('第一轮提问');

    const second = makeLoop(store, makeProvider(ok('第二轮回答')));
    const secondResult = await second.run('第二轮提问', { sessionId: firstResult.sessionId });

    const contents = secondResult.messages.map((message) => message.content ?? '');
    expect(contents.some((content) => content.includes('第一轮回答'))).toBe(true);
    const all = await store.listMessages(firstResult.sessionId);
    expect(all.length).toBe(4);
  });

  it('未配置存储：不报错，sessionId 仍生成', async () => {
    const loop = makeLoop(undefined, makeProvider(ok('ok')));
    const result = await loop.run('hi');
    expect(result.sessionId).toBeTruthy();
    expect(result.persisted).toBe(true);
  });

  it('存储故障：不阻断 run，persisted 为 false', async () => {
    const broken: ConversationStore = {
      name: 'broken',
      createSession: async (session) => session,
      appendMessage: async () => {
        throw new Error('disk on fire');
      },
      listMessages: async () => [],
      listSessions: async () => [],
      deleteSession: async () => false,
    };
    const loop = makeLoop(broken, makeProvider(ok('仍然可用')));

    const result = await loop.run('hi');

    expect(result.finalMessage.content).toBe('仍然可用');
    expect(result.persisted).toBe(false);
  });

  it('endSession 标记结束但保留历史', async () => {
    const store = new InMemoryConversationStore();
    const loop = makeLoop(store, makeProvider(ok('bye')));
    const result = await loop.run('hi');
    await loop.endSession();

    const [session] = await store.listSessions({ agentName: 'demo-agent' });
    expect(session?.status).toBe('ended');
    expect((await store.listMessages(result.sessionId)).length).toBe(2);
  });
});
