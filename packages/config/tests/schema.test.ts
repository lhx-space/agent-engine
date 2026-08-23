import { describe, expect, it } from 'vitest';
import { AgentConfigSchema, ModelConfigSchema } from '../src/schema/index.js';

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

  it('guardrail 规则缺 on 时校验失败', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'test-agent',
      model: { model: 'deepseek-chat' },
      systemPrompt: { template: 'hello' },
      rules: [{ id: 'r1', kind: 'guardrail' }],
    });
    expect(result.success).toBe(false);
  });

  it('guardrail 规则带 on 时校验通过', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'test-agent',
      model: { model: 'deepseek-chat' },
      systemPrompt: { template: 'hello' },
      rules: [{ id: 'r1', kind: 'guardrail', on: 'beforeToolCall' }],
    });
    expect(result.success).toBe(true);
  });
});
