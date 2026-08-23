import { describe, expect, it } from '@rstest/core';
import { buildSystemPrompt, renderTemplate } from '../src/context/build-system-prompt';

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
  it('模板渲染 + {{rules}} 占位符注入', () => {
    const prompt = buildSystemPrompt({
      systemPrompt: {
        template: '你是 {{role}}。\n必须遵守：\n{{rules}}',
        variables: { role: '前端专家' },
      },
      rulesText: '回答要简洁\n\n使用 <script setup> 语法',
    });

    expect(prompt).toContain('你是 前端专家');
    expect(prompt).toContain('回答要简洁');
    expect(prompt).toContain('使用 <script setup> 语法');
    expect(prompt).not.toContain('{{rules}}');
  });

  it('模板无 {{rules}} 占位符时追加规则文本', () => {
    const prompt = buildSystemPrompt({
      systemPrompt: { template: '你是助手' },
      rulesText: '回答要简洁',
    });

    expect(prompt).toContain('你是助手');
    expect(prompt).toContain('回答要简洁');
  });

  it('未提供 rulesText 时不注入规则', () => {
    const prompt = buildSystemPrompt({ systemPrompt: { template: '你是助手' } });

    expect(prompt).toBe('你是助手');
  });

  it('无匹配规则时 {{rules}} 替换为空串', () => {
    const prompt = buildSystemPrompt({
      systemPrompt: { template: '规则：\n{{rules}}' },
      rulesText: '',
    });

    expect(prompt).not.toContain('{{rules}}');
  });

  it('{{skills}} 占位符注入 + 兜底追加', () => {
    const prompt = buildSystemPrompt({
      systemPrompt: { template: '技能：\n{{skills}}' },
      skillsText: '## weather-qa\n查询天气后给穿衣建议。',
    });

    expect(prompt).toContain('穿衣建议');
    expect(prompt).not.toContain('{{skills}}');
  });
});
