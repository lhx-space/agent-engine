import { describe, expect, it } from '@rstest/core';
import type { EmbeddingProvider } from '../src/embedding/embedding';
import { hybridRetrieve } from '../src/retrieval/hybrid-retriever';
import { InMemoryVectorStore } from '../src/retrieval/vector-store';

function makeEmbedding(): EmbeddingProvider {
  return {
    name: 'mock',
    dimension: 2,
    async embed(texts) {
      return texts.map((text) => (text.includes('水果') ? [0, 1] : [1, 0]));
    },
  };
}

describe('hybridRetrieve', () => {
  it('双路召回 + RRF 融合去重', async () => {
    const store = new InMemoryVectorStore();
    await store.add([
      { id: 'a', vector: [1, 0] },
      { id: 'b', vector: [0, 1] },
    ]);

    const fused = await hybridRetrieve('水果', 2, {
      embedding: makeEmbedding(),
      vectorStore: store,
      // 词法召回：a 命中；b 只在向量路命中（语义补漏）
      lexical: () => [{ id: 'a', score: 9 }],
    });

    expect(fused.map((candidate) => candidate.id)).toContain('b');
    expect(new Set(fused.map((candidate) => candidate.id)).size).toBe(fused.length);
  });

  it('语义链路失败回落词法', async () => {
    const failing: EmbeddingProvider = {
      name: 'fail',
      dimension: 2,
      async embed() {
        throw new Error('embedding down');
      },
    };
    const fused = await hybridRetrieve('q', 2, {
      embedding: failing,
      vectorStore: new InMemoryVectorStore(),
      lexical: () => [{ id: 'a', score: 9 }],
    });

    expect(fused.map((candidate) => candidate.id)).toEqual(['a']);
  });
});
