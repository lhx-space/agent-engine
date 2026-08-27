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
  it('渲染 SystemPrompt 模板对象的用户变量', () => {
    const prompt = buildSystemPrompt({
      systemPrompt: { template: '你是 {{role}}。', variables: { role: '前端专家' } },
    });

    expect(prompt).toBe('你是 前端专家。');
  });

  it('无用户变量时原样返回模板', () => {
    const prompt = buildSystemPrompt({ systemPrompt: { template: '你是助手' } });

    expect(prompt).toBe('你是助手');
  });
});
