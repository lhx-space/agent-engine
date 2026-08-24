import { describe, expect, it } from '@rstest/core';
import { AgentConfigSchema } from '@agent-engine/config';
import type { LLMProvider } from '@agent-engine/core';
import { createApp } from '../src/app';

function makeProvider(): LLMProvider {
  return {
    name: 'mock',
    async chatCompletion() {
      return { message: { role: 'assistant', content: 'ok' } };
    },
  };
}

function makeStreamingProvider(): LLMProvider {
  return {
    name: 'mock-stream',
    async chatCompletionStream(_params, onDelta) {
      onDelta('你');
      onDelta('好');
      return { message: { role: 'assistant', content: '你好' } };
    },
  };
}

function makeConfig(overrides: Record<string, unknown> = {}) {
  return AgentConfigSchema.parse({
    name: 'test-agent',
    model: { provider: 'custom', baseURL: 'http://localhost', model: 'mock' },
    systemPrompt: { template: '你是助手', variables: {} },
    ...overrides,
  });
}

describe('server-api', () => {
  it('GET /health 返回 ok', async () => {
    const res = await createApp().request('/health');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('POST /api/agent/run 返回 AgentLoopResult', async () => {
    const app = createApp({ providerFactory: makeProvider });
    const res = await app.request('/api/agent/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config: makeConfig(), input: 'hi' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { finalMessage: { content: string }; steps: number };
    expect(body.finalMessage.content).toBe('ok');
    expect(body.steps).toBe(1);
  });

  it('非法 config 返回 400', async () => {
    const res = await createApp().request('/api/agent/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config: { name: 'x' }, input: 'hi' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid config');
  });

  it('plugin 名缺失返回 500', async () => {
    const app = createApp({ providerFactory: makeProvider });
    const res = await app.request('/api/agent/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config: makeConfig({ plugins: ['missing-plugin'] }), input: 'hi' }),
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('agent execution failed');
  });

  it('POST /api/agent/run/stream 返回 NDJSON 事件流', async () => {
    const app = createApp({ providerFactory: makeStreamingProvider });
    const res = await app.request('/api/agent/run/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config: makeConfig(), input: 'hi' }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');

    const text = await res.text();
    const lines = text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { type: string });
    expect(lines[0]?.type).toBe('step_start');
    expect(lines.some((line) => line.type === 'llm_delta')).toBe(true);
    expect(lines[lines.length - 1]?.type).toBe('done');
  });

  it('config.plugins 声明 @agent-engine/plugin-files 后 server 注入 factory', async () => {
    let capturedTools: string[] = [];
    const app = createApp({
      providerFactory: () => ({
        name: 'mock',
        async chatCompletion(params) {
          capturedTools = (params.tools ?? []).map((tool) => tool.function.name);
          return { message: { role: 'assistant', content: 'ok' } };
        },
      }),
    });

    const res = await app.request('/api/agent/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: makeConfig({ plugins: ['@agent-engine/plugin-files'] }),
        input: 'hi',
      }),
    });

    expect(res.status).toBe(200);
    expect(capturedTools).toContain('builtin_read_file');
    expect(capturedTools).toContain('builtin_write_file');
  });
});
