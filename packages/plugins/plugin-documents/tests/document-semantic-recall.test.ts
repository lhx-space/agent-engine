import { describe, expect, it } from '@rstest/core';
import type { EmbeddingProvider } from '@agent-engine/core/embedding';
import { DocumentIndex } from '../src/index';

/** 确定性 mock embedding：按关键词把文本映射到 2 维向量。 */
function makeEmbedding(): EmbeddingProvider {
  return {
    name: 'mock',
    dimension: 2,
    async embed(texts) {
      return texts.map((text) => {
        if (text.includes('水果') || text.includes('维他命') || text.includes('营养')) {
          return [0, 1];
        }
        return [1, 0];
      });
    },
  };
}

describe('DocumentIndex 混合召回', () => {
  it('无 embedding 回落 BM25 词法', async () => {
    const index = new DocumentIndex({ topK: 2 });
    await index.addChunks([{ text: '今天天气很好', metadata: {} }]);
    const hits = await index.retrieve('天气');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.text).toContain('天气');
  });

  it('有 embedding 时语义召回补漏（无词面重叠）', async () => {
    const index = new DocumentIndex({ topK: 2, embedding: makeEmbedding() });
    await index.addChunks([
      { text: '今天股市大涨', metadata: {} },
      { text: '水果富含营养', metadata: {} },
    ]);
    const hits = await index.retrieve('维他命怎么补充');
    expect(hits.some((chunk) => chunk.text.includes('水果'))).toBe(true);
  });

  it('有 embedding 时词面命中仍优先', async () => {
    const index = new DocumentIndex({ topK: 2, embedding: makeEmbedding() });
    await index.addChunks([
      { text: '今天股市大涨', metadata: {} },
      { text: '水果富含营养', metadata: {} },
    ]);
    const hits = await index.retrieve('股市');
    expect(hits[0]?.text).toContain('股市');
  });
});
