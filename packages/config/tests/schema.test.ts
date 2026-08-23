import { describe, expect, it } from 'vitest';
import { AgentConfigSchema, ModelConfigSchema } from '../src/schema/index';

describe('ModelConfigSchema', () => {
  it('provider 缺省时默认 openai-compatible', () => {
    const result = ModelConfigSchema.parse({ model: 'deepseek-chat' });
    expect(result.provider).toBe('openai-compatible');
  });
});

describe('AgentConfigSchema', () => {
  it('最小合法配置通过校验', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'test-agent',
      model: { model: 'deepseek-chat' },
      systemPrompt: { template: 'hello' },
    });
    expect(result.success).toBe(true);
  });

  it('规则缺 content 时校验失败', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'test-agent',
      model: { model: 'deepseek-chat' },
      systemPrompt: { template: 'hello' },
      rules: [{ id: 'r1', description: 'x' }],
    });
    expect(result.success).toBe(false);
  });

  it('规则 kind 缺省默认 on-demand', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'test-agent',
      model: { model: 'deepseek-chat' },
      systemPrompt: { template: 'hello' },
      rules: [{ id: 'r1', description: 'x', content: 'y' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rules[0]).toMatchObject({ kind: 'on-demand' });
    }
  });

  it('规则含 content 与 tags 时校验通过', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'test-agent',
      model: { model: 'deepseek-chat' },
      systemPrompt: { template: 'hello' },
      rules: [{ id: 'r1', kind: 'always', description: 'x', content: 'y', tags: ['vue'] }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rules[0]).toMatchObject({ kind: 'always', tags: ['vue'] });
    }
  });
});
