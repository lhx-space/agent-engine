import { describe, expect, it } from '@rstest/core';
import type { Rule } from '@agent-engine/config';
import { CapabilityLoader } from '../src/retrieval/loader';
import { CapabilityRegistry } from '../src/retrieval/registry';

describe('CapabilityRegistry', () => {
  it('注册与按类型过滤', () => {
    const registry = new CapabilityRegistry();
    registry.register({ id: 'r1', type: 'rule', description: 'Vue 编码规范', tags: ['vue'] });
    registry.register({ id: 's1', type: 'skill', description: '事故响应', tags: [] });

    expect(registry.listByType('rule')).toHaveLength(1);
    expect(registry.listByType('skill')).toHaveLength(1);
  });

  it('关键词召回含得分', async () => {
    const registry = new CapabilityRegistry();
    registry.register({
      id: 'r1',
      type: 'rule',
      description: 'Vue3 TypeScript 编码规范',
      tags: ['vue', 'ts'],
    });
    registry.register({
      id: 'r2',
      type: 'rule',
      description: '数据库优化规范',
      tags: ['sql'],
    });

    const hits = await registry.retrieve('帮我写个 Vue 组件', 5);

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.meta.id).toBe('r1');
    expect(hits[0]?.score).toBeGreaterThan(0);
  });
});

describe('CapabilityLoader', () => {
  const rules: Rule[] = [
    { id: 'always-concise', kind: 'always', description: '简洁', content: '回答要简洁', tags: [] },
    {
      id: 'vue-ts',
      kind: 'on-demand',
      description: 'Vue3 TypeScript 编码规范',
      content: '使用 <script setup> 语法',
      tags: ['vue'],
    },
  ];

  it('按 type 过滤：只返回 rule 记录', async () => {
    const registry = new CapabilityRegistry();
    registry.register({ id: 's1', type: 'skill', description: 'Vue 编码规范', tags: [] });
    const loader = new CapabilityLoader<Rule>('rule', rules, { registry });

    const hits = await loader.loadForQuery('帮我写 Vue 组件', 5);

    expect(hits.every((h) => h.record.id !== 's1')).toBe(true);
  });
});
