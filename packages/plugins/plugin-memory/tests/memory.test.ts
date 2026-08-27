import { describe, expect, it } from '@rstest/core';
import type { EmbeddingProvider } from '@agent-engine/core/embedding';
import { InMemoryMemoryBackend } from '@agent-engine/core/memory';
import { InMemoryVectorStore } from '@agent-engine/core/retrieval';
import { SemanticMemory } from '../src/index';

function makeEmbedding(): EmbeddingProvider {
  return {
    name: 'mock',
    dimension: 2,
    async embed(texts: string[]) {
      return texts.map(() => [1, 0]);
    },
  };
}

describe('SemanticMemory', () => {
  it('remember 向量化写入 + recall 召回', async () => {
    const backend = new InMemoryMemoryBackend();
    const store = new InMemoryVectorStore();
    const mem = new SemanticMemory(store, makeEmbedding(), backend);

    await mem.remember('用户偏好蓝色');
    const recalled = await mem.recall('喜欢什么颜色', 3);

    expect(recalled).toContain('用户偏好蓝色');
    // 同时持久化到 MemoryBackend。
    expect(await backend.keys()).toHaveLength(1);
  });

  it('无 embedding 时 no-op', async () => {
    const backend = new InMemoryMemoryBackend();
    const store = new InMemoryVectorStore();
    const mem = new SemanticMemory(store, undefined, backend);

    await mem.remember('不会写入');
    expect(await mem.recall('任意')).toEqual([]);
    expect(await backend.keys()).toHaveLength(0);
  });
});
