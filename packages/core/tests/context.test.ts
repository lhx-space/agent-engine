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
  it('模板渲染 + {{skills}} 占位符注入', () => {
    const prompt = buildSystemPrompt({
      systemPrompt: {
        template: '你是 {{role}}。\n技能：\n{{skills}}',
        variables: { role: '前端专家' },
      },
      skillsText: '## weather-qa\n查询天气后给穿衣建议。',
    });

    expect(prompt).toContain('你是 前端专家');
    expect(prompt).toContain('穿衣建议');
    expect(prompt).not.toContain('{{skills}}');
  });

  it('模板无 {{skills}} 占位符时追加技能文本', () => {
    const prompt = buildSystemPrompt({
      systemPrompt: { template: '你是助手' },
      skillsText: '查询天气后给穿衣建议。',
    });

    expect(prompt).toContain('你是助手');
    expect(prompt).toContain('穿衣建议');
  });

  it('未提供 skillsText 时不注入技能', () => {
    const prompt = buildSystemPrompt({ systemPrompt: { template: '你是助手' } });

    expect(prompt).toBe('你是助手');
  });

  it('无匹配技能时 {{skills}} 替换为空串', () => {
    const prompt = buildSystemPrompt({
      systemPrompt: { template: '技能：\n{{skills}}' },
      skillsText: '',
    });

    expect(prompt).not.toContain('{{skills}}');
  });
});
