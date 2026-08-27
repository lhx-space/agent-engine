import { describe, expect, it } from '@rstest/core';
import type { Rule } from '@agent-engine/config';
import type { ContextContributor } from '@agent-engine/core/context';
import type { EmbeddingProvider } from '@agent-engine/core/embedding';
import type { PluginContext } from '@agent-engine/core/plugins';
import { createRulesPlugin, loadRulesText } from '../src/index';

function makeCtx(): { ctx: PluginContext; contributors: ContextContributor[] } {
  const contributors: ContextContributor[] = [];
  const ctx = {
    registerContextContributor: (contributor: ContextContributor) => contributors.push(contributor),
  } as PluginContext;
  return { ctx, contributors };
}

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

describe('createRulesPlugin', () => {
  const rules: Rule[] = [
    { id: 'always-concise', kind: 'always', description: '简洁', content: '回答要简洁', tags: [] },
    {
      id: 'vue-ts',
      kind: 'on-demand',
      description: 'Vue3 TypeScript 编码规范',
      content: '使用 <script setup> 语法',
      tags: ['vue'],
    },
    {
      id: 'db-opt',
      kind: 'on-demand',
      description: '数据库优化规范',
      content: '查询要加索引',
      tags: ['sql'],
    },
  ];

  it('安装后注册 ContextContributor', async () => {
    const { ctx, contributors } = makeCtx();
    await createRulesPlugin(rules).install(ctx);
    expect(contributors).toHaveLength(1);
    expect(contributors[0]?.name).toBe('@agent-engine/plugin-rules');
  });

  it('always 强制注入 + on-demand BM25 召回', async () => {
    const { ctx, contributors } = makeCtx();
    await createRulesPlugin(rules).install(ctx);
    const contribution = await contributors[0]!.contribute({ userInput: '帮我写 Vue 组件' });
    expect(contribution?.text).toContain('回答要简洁');
    expect(contribution?.text).toContain('<script setup>');
    expect(contribution?.text).not.toContain('加索引');
  });

  it('空规则返回空贡献', async () => {
    const { ctx, contributors } = makeCtx();
    await createRulesPlugin([]).install(ctx);
    expect(contributors).toHaveLength(1);
    const contribution = await contributors[0]!.contribute({ userInput: '任意 query' });
    expect(contribution).toBeUndefined();
  });

  it('语义召回命中无词面重叠的规则（embedding）', async () => {
    const semanticRules: Rule[] = [
      {
        id: 'stock',
        kind: 'on-demand',
        description: '今天股市大涨',
        content: '股市内容',
        tags: [],
      },
      {
        id: 'fruit',
        kind: 'on-demand',
        description: '水果富含营养',
        content: '水果内容',
        tags: ['健康'],
      },
    ];
    const { ctx, contributors } = makeCtx();
    await createRulesPlugin(semanticRules, { embedding: makeEmbedding(), topK: 1 }).install(ctx);
    const contribution = await contributors[0]!.contribute({ userInput: '维他命怎么补充' });
    expect(contribution?.text).toContain('水果内容');
    expect(contribution?.text).not.toContain('股市内容');
  });
});

describe('loadRulesText（纯函数）', () => {
  it('always 全注入 + on-demand 去重拼接', () => {
    const rules: Rule[] = [
      { id: 'a', kind: 'always', description: 'x', content: '总是遵守', tags: [] },
      { id: 'b', kind: 'on-demand', description: 'x', content: '命中 B', tags: [] },
      { id: 'c', kind: 'on-demand', description: 'x', content: '命中 C', tags: [] },
    ];
    const text = loadRulesText(rules, [rules[1]!]);
    expect(text).toContain('总是遵守');
    expect(text).toContain('命中 B');
    expect(text).not.toContain('命中 C');
  });

  it('无命中 on-demand 时仅注入 always', () => {
    const rules: Rule[] = [
      { id: 'a', kind: 'always', description: 'x', content: '总是遵守', tags: [] },
      { id: 'b', kind: 'on-demand', description: 'x', content: '命中 B', tags: [] },
    ];
    const text = loadRulesText(rules, []);
    expect(text).toBe('总是遵守');
  });

  it('空规则返回空串', () => {
    expect(loadRulesText([], [])).toBe('');
  });
});
