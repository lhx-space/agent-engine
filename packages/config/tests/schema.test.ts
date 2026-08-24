import { describe, expect, it } from '@rstest/core';
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

  it('缺省 security 时默认安全', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'test-agent',
      model: { model: 'deepseek-chat' },
      systemPrompt: { template: 'hello' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.security.sandbox.backend).toBe('auto');
      expect(result.data.security.sandbox.image).toBe('agent-engine/sandbox');
      expect(result.data.security.bash.enabled).toBe(false);
      expect(result.data.security.bash.allowNetwork).toBe(false);
      expect(result.data.security.files.maxFileBytes).toBe(1048576);
      expect(result.data.security.webSearch.provider).toBe('duckduckgo');
      expect(result.data.security.webSearch.maxResults).toBe(8);
    }
  });

  it('bash 显式开启并声明策略', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'test-agent',
      model: { model: 'deepseek-chat' },
      systemPrompt: { template: 'hello' },
      security: { bash: { enabled: true, allowCommands: ['kubectl'], allowNetwork: true } },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.security.bash.enabled).toBe(true);
      expect(result.data.security.bash.allowCommands).toEqual(['kubectl']);
      expect(result.data.security.bash.allowNetwork).toBe(true);
    }
  });

  it('非法 sandbox backend 校验失败', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'test-agent',
      model: { model: 'deepseek-chat' },
      systemPrompt: { template: 'hello' },
      security: { sandbox: { backend: 'k8s' } },
    });
    expect(result.success).toBe(false);
  });

  it('execution 缺省对齐现状', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'test-agent',
      model: { model: 'deepseek-chat' },
      systemPrompt: { template: 'hello' },
      execution: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.execution).toMatchObject({
        maxSteps: 10,
        toolRetry: { maxRetries: 0, baseDelayMs: 500 },
        maxContinuations: 1,
      });
    }
  });

  it('execution 显式覆盖预算与重试', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'test-agent',
      model: { model: 'deepseek-chat' },
      systemPrompt: { template: 'hello' },
      execution: { maxSteps: 20, maxToolCalls: 8, timeoutMs: 60000, toolRetry: { maxRetries: 3 } },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.execution).toMatchObject({
        maxSteps: 20,
        maxToolCalls: 8,
        timeoutMs: 60000,
        toolRetry: { maxRetries: 3, baseDelayMs: 500 },
      });
    }
  });
});
