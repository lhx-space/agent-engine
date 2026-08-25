import { describe, expect, it } from '@rstest/core';
import { AgentConfigSchema } from '@agent-engine/config';
import type { EmbeddingProvider } from '../src/embedding/embedding';
import type { LLMProvider } from '../src/llm/types';
import { InMemoryVectorStore } from '../src/retrieval/vector-store';
import type { VectorStore } from '../src/retrieval/vector-store';
import { resolveAgentConfig } from '../src/resolve/resolve';

function makeProvider(): LLMProvider {
  return {
    name: 'mock',
    async chatCompletion() {
      return { message: { role: 'assistant', content: 'ok' } };
    },
  };
}

describe('InMemoryVectorStore', () => {
  it('按余弦相似度召回 top-k', async () => {
    const store = new InMemoryVectorStore();
    await store.add([
      { id: 'a', vector: [1, 0] },
      { id: 'b', vector: [0, 1] },
    ]);
    const matches = await store.query([1, 0.1], 1);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe('a');
    expect(matches[0]!.score).toBeGreaterThan(0.9);
  });

  it('delete / clear', async () => {
    const store = new InMemoryVectorStore();
    await store.add([
      { id: 'a', vector: [1, 0] },
      { id: 'b', vector: [0, 1] },
    ]);
    expect(await store.delete(['a'])).toBe(1);
    expect((await store.query([1, 0], 10)).map((m) => m.id)).toEqual(['b']);
    await store.clear();
    expect(await store.query([1, 0], 10)).toEqual([]);
  });
});

describe('resolveAgentConfig 语义检索后端', () => {
  it('缺省 in-memory vectorStore + 无 embedding', async () => {
    const config = AgentConfigSchema.parse({
      name: 't',
      model: { provider: 'custom', baseURL: 'http://localhost', model: 'mock' },
      systemPrompt: { template: 'hi' },
    });
    const resolved = await resolveAgentConfig(config, { providerFactory: () => makeProvider() });
    expect(resolved.vectorStore.name).toBe('in-memory');
    expect(resolved.embeddingProvider).toBeUndefined();
    await resolved.dispose();
  });

  it('插件注册 vectorStore + embedding', async () => {
    const customStore: VectorStore = {
      name: 'pgvector',
      add: async () => {},
      query: async () => [],
      delete: async () => 0,
      clear: async () => {},
    };
    const customEmbed: EmbeddingProvider = {
      name: 'openai',
      dimension: 3,
      embed: async (texts) => texts.map(() => [0, 0, 0]),
    };
    const config = AgentConfigSchema.parse({
      name: 't',
      model: { provider: 'custom', baseURL: 'http://localhost', model: 'mock' },
      systemPrompt: { template: 'hi' },
      plugins: ['retrieval-plugin'],
    });
    const resolved = await resolveAgentConfig(config, {
      providerFactory: () => makeProvider(),
      pluginFactories: {
        'retrieval-plugin': () => ({
          name: 'retrieval-plugin',
          description: '测试检索插件',
          version: '1.0.0',
          install(ctx) {
            ctx.registerVectorStore(customStore);
            ctx.registerEmbeddingProvider(customEmbed);
          },
        }),
      },
    });
    expect(resolved.vectorStore.name).toBe('pgvector');
    expect(resolved.embeddingProvider?.name).toBe('openai');
    await resolved.dispose();
  });
});
