import { describe, expect, it } from 'vitest';
import type { Rule } from '@agent-engine/config';
import { buildSystemPrompt, renderTemplate } from '../src/context/build-system-prompt';
import { RuleLoader } from '../src/rules/loader';

describe('renderTemplate', () => {
  it('替换变量', () => {
    expect(renderTemplate('你好 {{name}}', { name: '世界' })).toBe('你好 世界');
  });

  it('未提供的变量保留原样', () => {
    expect(renderTemplate('你好 {{name}}', {})).toBe('你好 {{name}}');
  });

  it('null / undefined 替换为空串', () => {
    expect(renderTemplate('a{{x}}b', { x: null })).toBe('ab');
    expect(renderTemplate('a{{x}}b', { x: undefined })).toBe('ab');
  });

  it('变量名支持空格与点号', () => {
    expect(renderTemplate('{{ role }}', { role: 'dev' })).toBe('dev');
    expect(renderTemplate('{{user.name}}', { 'user.name': 'tom' })).toBe('tom');
  });
});

describe('buildSystemPrompt', () => {
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

  it('模板渲染 + {{rules}} 占位符注入', () => {
    const loader = new RuleLoader(rules);
    const prompt = buildSystemPrompt('帮我写 Vue 组件', {
      systemPrompt: {
        template: '你是 {{role}}。\n必须遵守：\n{{rules}}',
        variables: { role: '前端专家' },
      },
      ruleLoader: loader,
    });

    expect(prompt).toContain('你是 前端专家');
    expect(prompt).toContain('回答要简洁');
    expect(prompt).toContain('使用 <script setup> 语法');
    expect(prompt).not.toContain('{{rules}}');
  });

  it('模板无 {{rules}} 占位符时追加规则文本', () => {
    const loader = new RuleLoader(rules);
    const prompt = buildSystemPrompt('帮我写 Vue 组件', {
      systemPrompt: { template: '你是助手' },
      ruleLoader: loader,
    });

    expect(prompt).toContain('你是助手');
    expect(prompt).toContain('回答要简洁');
    expect(prompt).toContain('使用 <script setup> 语法');
  });

  it('未提供 ruleLoader 时不注入规则', () => {
    const prompt = buildSystemPrompt('hi', {
      systemPrompt: { template: '你是助手' },
    });

    expect(prompt).toBe('你是助手');
  });

  it('无匹配规则时 {{rules}} 替换为空串', () => {
    const loader = new RuleLoader([
      { id: 'vue-ts', kind: 'on-demand', description: 'Vue 规范', content: 'x', tags: [] },
    ]);
    const prompt = buildSystemPrompt('今天天气如何', {
      systemPrompt: { template: '规则：\n{{rules}}' },
      ruleLoader: loader,
    });

    expect(prompt).not.toContain('x');
    expect(prompt).not.toContain('{{rules}}');
  });
});
