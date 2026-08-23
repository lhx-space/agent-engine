import { describe, expect, it } from 'vitest';
import type { Rule } from '@agent-engine/config';
import { CapabilityLoader } from '../src/retrieval/loader';
import { CapabilityRegistry } from '../src/retrieval/registry';
import { loadRulesText } from '../src/rules/load';

describe('CapabilityRegistry', () => {
  it('注册与按类型过滤', () => {
    const registry = new CapabilityRegistry();
    registry.register({ id: 'r1', type: 'rule', description: 'Vue 编码规范', tags: ['vue'] });
    registry.register({ id: 's1', type: 'skill', description: '事故响应', tags: [] });

    expect(registry.listByType('rule')).toHaveLength(1);
    expect(registry.listByType('skill')).toHaveLength(1);
  });

  it('关键词召回含得分', () => {
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

    const hits = registry.retrieve('帮我写个 Vue 组件', 5);

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.meta.id).toBe('r1');
    expect(hits[0]?.score).toBeGreaterThan(0);
  });
});

describe('CapabilityLoader + loadRulesText', () => {
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

  it('always 强制注入 + on-demand 召回', () => {
    const loader = new CapabilityLoader<Rule>('rule', rules);
    const text = loadRulesText(rules, loader, '帮我写 Vue 组件', 5);

    expect(text).toContain('回答要简洁');
    expect(text).toContain('<script setup>');
    expect(text).not.toContain('加索引');
  });

  it('按 type 过滤：只返回 rule 记录', () => {
    const registry = new CapabilityRegistry();
    registry.register({ id: 's1', type: 'skill', description: 'Vue 编码规范', tags: [] });
    const loader = new CapabilityLoader<Rule>('rule', rules, registry);

    const hits = loader.loadForQuery('帮我写 Vue 组件', 5);

    expect(hits.every((h) => h.record.id !== 's1')).toBe(true);
  });

  it('C1 空集合兜底：无匹配返回空串', () => {
    const loader = new CapabilityLoader<Rule>('rule', [
      {
        id: 'vue-ts',
        kind: 'on-demand',
        description: 'Vue3 TypeScript 编码规范',
        content: '使用 <script setup>',
        tags: [],
      },
    ]);
    const text = loadRulesText(
      [
        {
          id: 'vue-ts',
          kind: 'on-demand',
          description: 'Vue3 TypeScript 编码规范',
          content: '使用 <script setup>',
          tags: [],
        },
      ],
      loader,
      '今天天气如何',
      5,
    );

    expect(text).toBe('');
  });
});
