import { describe, expect, it } from '@rstest/core';
import { AgentConfigSchema } from '@lhx-agent-engine/config';
import { createEmbeddingProvider } from '../src/embedding/openai';
import type { LLMProvider } from '../src/llm/types';
import { resolveAgentConfig } from '../src/resolve/resolve';
import type { FetchLike, HttpResponse } from '../src/tools/utils/http';

function fakeResponse(overrides: Partial<HttpResponse> = {}): HttpResponse {
  return {
    ok: true,
    status: 200,
    contentType: 'application/json',
    text: async () => '',
    json: async () => ({}),
    ...overrides,
  };
}

function makeProvider(): LLMProvider {
  return {
    name: 'mock',
    async chatCompletion() {
      return { message: { role: 'assistant', content: 'ok' } };
    },
  };
}

describe('createEmbeddingProvider', () => {
  it('embed 调用 /embeddings 并返回等长向量、推断 dimension', async () => {
    let capturedUrl = '';
    let capturedBody = '';
    const fakeFetch: FetchLike = async (url, init) => {
      capturedUrl = url;
      capturedBody = init?.body ?? '';
      return fakeResponse({
        json: async () => ({ data: [{ embedding: [1, 0, 0] }, { embedding: [0, 1, 0] }] }),
      });
    };
    const provider = createEmbeddingProvider({ model: 'text-embedding-3-small' }, fakeFetch);
    const vectors = await provider.embed(['a', 'b']);
    expect(capturedUrl).toContain('/embeddings');
    expect(capturedBody).toContain('text-embedding-3-small');
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toEqual([1, 0, 0]);
    expect(provider.dimension).toBe(3);
  });

  it('显式 dimension', () => {
    const provider = createEmbeddingProvider({ model: 'm', dimension: 768 }, async () =>
      fakeResponse(),
    );
    expect(provider.dimension).toBe(768);
  });

  it('非 2xx 抛错', async () => {
    const provider = createEmbeddingProvider({ model: 'm' }, async () =>
      fakeResponse({ ok: false, status: 500 }),
    );
    await expect(provider.embed(['a'])).rejects.toThrow(/500/);
  });
});

describe('resolveAgentConfig embedding 解析', () => {
  it('配置 embedding 解析出 provider', async () => {
    const config = AgentConfigSchema.parse({
      name: 't',
      model: { provider: 'custom', baseURL: 'http://localhost', model: 'mock' },
      systemPrompt: { template: 'hi' },
      embedding: { baseURL: 'http://localhost/v1', model: 'emb' },
    });
    const resolved = await resolveAgentConfig(config, { providerFactory: () => makeProvider() });
    expect(resolved.embeddingProvider?.name).toBe('openai-compatible:emb');
    await resolved.dispose();
  });
});
