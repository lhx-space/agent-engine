import { describe, expect, it } from '@rstest/core';
import { AgentConfigSchema } from '@agent-engine/config';
import type { ChatMessage, LLMProvider, ProviderFactory } from '@agent-engine/core';
import { createApp } from '../src/app';
import type { SessionStoreBackend } from '../src/session-store';

function makeConfig() {
  return AgentConfigSchema.parse({
    name: 'test-agent',
    model: { provider: 'custom', baseURL: 'http://localhost', model: 'mock' },
    systemPrompt: { template: '你是助手' },
  });
}

/** 记录所有 LLM 调用入参的 provider 工厂（跨请求复用同一 provider 实例）。 */
function makeRecordingProviderFactory(): { factory: ProviderFactory; seen: ChatMessage[][] } {
  const seen: ChatMessage[][] = [];
  let count = 0;
  const factory: ProviderFactory = (): LLMProvider => ({
    name: 'rec',
    async chatCompletion(params) {
      seen.push(params.messages);
      count += 1;
      return { message: { role: 'assistant', content: `answer-${count}` } };
    },
  });
  return { factory, seen };
}

describe('server session', () => {
  it('首次 run 返回 sessionId，复用 session 累积历史', async () => {
    const { factory, seen } = makeRecordingProviderFactory();
    const app = createApp({ providerFactory: factory });
    const config = makeConfig();

    const res1 = await app.request('/api/agent/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config, input: '第一问' }),
    });
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as { sessionId: string };
    expect(body1.sessionId).toBeTruthy();

    const res2 = await app.request('/api/agent/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config, input: '第二问', sessionId: body1.sessionId }),
    });
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { sessionId: string };
    expect(body2.sessionId).toBe(body1.sessionId);

    // 第二轮 LLM 调用应携带第一轮历史
    const secondCall = seen[1];
    expect(secondCall?.some((m) => m.role === 'user' && m.content === '第一问')).toBe(true);
    expect(secondCall?.some((m) => m.role === 'assistant' && m.content === 'answer-1')).toBe(true);
  });

  it('未知 sessionId 回退新建会话', async () => {
    const app = createApp({
      providerFactory: () => ({
        name: 'mock',
        async chatCompletion() {
          return { message: { role: 'assistant', content: 'ok' } };
        },
      }),
    });

    const res = await app.request('/api/agent/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: makeConfig(),
        input: 'hi',
        sessionId: 'does-not-exist',
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sessionId: string };
    expect(body.sessionId).toBeTruthy();
    expect(body.sessionId).not.toBe('does-not-exist');
  });

  it('DELETE 会话返回 ok', async () => {
    const app = createApp({
      providerFactory: () => ({
        name: 'mock',
        async chatCompletion() {
          return { message: { role: 'assistant', content: 'ok' } };
        },
      }),
    });

    const res = await app.request('/api/agent/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config: makeConfig(), input: 'hi' }),
    });
    const body = (await res.json()) as { sessionId: string };

    const del = await app.request(`/api/agent/sessions/${body.sessionId}`, { method: 'DELETE' });
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ ok: true });
  });

  it('注入自定义 SessionStoreBackend 生效', async () => {
    const ops: string[] = [];
    const custom: SessionStoreBackend = {
      async get(id) {
        ops.push(`get:${id}`);
        return undefined;
      },
      async set(id) {
        ops.push(`set:${id}`);
      },
      async delete(id) {
        ops.push(`delete:${id}`);
      },
      async clear() {
        ops.push('clear');
      },
    };

    const app = createApp({
      providerFactory: () => ({
        name: 'mock',
        async chatCompletion() {
          return { message: { role: 'assistant', content: 'ok' } };
        },
      }),
      sessionStore: custom,
    });

    const res = await app.request('/api/agent/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config: makeConfig(), input: 'hi', sessionId: 'custom-1' }),
    });
    expect(res.status).toBe(200);
    expect(ops.some((op) => op.startsWith('get:'))).toBe(true);
    expect(ops.some((op) => op.startsWith('set:'))).toBe(true);
  });

  it('stream 响应带 x-session-id 头', async () => {
    const app = createApp({
      providerFactory: () => ({
        name: 'mock-stream',
        async chatCompletionStream(_params, onDelta) {
          onDelta('hi');
          return { message: { role: 'assistant', content: 'hi' } };
        },
      }),
    });

    const res = await app.request('/api/agent/run/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config: makeConfig(), input: 'hi' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-session-id')).toBeTruthy();
  });
});
