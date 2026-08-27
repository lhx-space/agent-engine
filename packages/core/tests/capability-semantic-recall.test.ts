import { describe, expect, it } from '@rstest/core';
import type { Rule } from '@agent-engine/config';
import type { EmbeddingProvider } from '../src/embedding/embedding';
import { CapabilityLoader } from '../src/retrieval/loader';
import { CapabilityRegistry } from '../src/retrieval/registry';
import { loadRulesText } from '../src/rules/load';

/** 确定性 mock embedding：按关键词把「description + tags」映射到 2 维向量。 */
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

describe('CapabilityRegistry 语义召回', () => {
  it('有 embedding 时语义召回补漏（无词面重叠）', async () => {
    const registry = new CapabilityRegistry({ embedding: makeEmbedding() });
    registry.register({ id: 'stock', type: 'rule', description: '今天股市大涨', tags: [] });
    registry.register({ id: 'fruit', type: 'rule', description: '水果富含营养', tags: ['健康'] });

    const hits = await registry.retrieve('维他命怎么补充', 2);
    expect(hits.some((hit) => hit.meta.id === 'fruit')).toBe(true);
  });

  it('无 embedding 回落 BM25 词法', async () => {
    const registry = new CapabilityRegistry();
    registry.register({ id: 'r1', type: 'rule', description: 'Vue3 编码规范', tags: ['vue'] });

    const hits = await registry.retrieve('Vue 组件', 5);
    expect(hits.some((hit) => hit.meta.id === 'r1')).toBe(true);
  });

  it('语义链路失败优雅回落 BM25', async () => {
    const failing: EmbeddingProvider = {
      name: 'fail',
      dimension: 2,
      async embed() {
        throw new Error('embedding down');
      },
    };
    const registry = new CapabilityRegistry({ embedding: failing });
    registry.register({ id: 'r1', type: 'rule', description: 'Vue3 编码规范', tags: ['vue'] });

    const hits = await registry.retrieve('Vue 组件', 5);
    expect(hits.some((hit) => hit.meta.id === 'r1')).toBe(true);
  });
});

describe('CapabilityLoader + loadRulesText 语义召回', () => {
  const rules: Rule[] = [
    { id: 'stock', kind: 'on-demand', description: '今天股市大涨', content: '股市内容', tags: [] },
    {
      id: 'fruit',
      kind: 'on-demand',
      description: '水果富含营养',
      content: '水果内容',
      tags: ['健康'],
    },
  ];

  it('loadForQuery 语义召回命中无词面重叠的规则', async () => {
    const loader = new CapabilityLoader<Rule>('rule', rules, { embedding: makeEmbedding() });
    const hits = await loader.loadForQuery('维他命怎么补充', 2);
    expect(hits.some((hit) => hit.record.id === 'fruit')).toBe(true);
  });

  it('loadRulesText 经语义召回注入 content', async () => {
    const loader = new CapabilityLoader<Rule>('rule', rules, { embedding: makeEmbedding() });
    const text = await loadRulesText(rules, loader, '维他命怎么补充', 1);
    expect(text).toContain('水果内容');
    expect(text).not.toContain('股市内容');
  });
});
