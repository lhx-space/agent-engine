import { describe, expect, it } from '@rstest/core';
import { AgentConfigSchema, ModelConfigSchema } from '../src/schema/index';

describe('ModelConfigSchema', () => {
  it('provider 缺省时默认 openai-compatible', () => {
    const result = ModelConfigSchema.parse({ model: 'deepseek-chat' });
    expect(result.provider).toBe('openai-compatible');
  });

  it('采样参数声明后按值解析', () => {
    const result = ModelConfigSchema.parse({
      model: 'deepseek-chat',
      topP: 0.7,
      frequencyPenalty: 0.3,
      presencePenalty: 0.1,
      stop: ['END'],
      seed: 42,
    });
    expect(result.topP).toBe(0.7);
    expect(result.frequencyPenalty).toBe(0.3);
    expect(result.presencePenalty).toBe(0.1);
    expect(result.stop).toEqual(['END']);
    expect(result.seed).toBe(42);
  });

  it('越界采样参数拒绝（topP>1、frequencyPenalty>2）', () => {
    expect(ModelConfigSchema.safeParse({ model: 'm', topP: 2 }).success).toBe(false);
    expect(ModelConfigSchema.safeParse({ model: 'm', frequencyPenalty: 3 }).success).toBe(false);
    expect(ModelConfigSchema.safeParse({ model: 'm', presencePenalty: -3 }).success).toBe(false);
  });

  it('工具调用与透传参数解析', () => {
    const result = ModelConfigSchema.parse({
      model: 'deepseek-chat',
      toolChoice: 'required',
      parallelToolCalls: false,
      extra: { beta: true },
    });
    expect(result.toolChoice).toBe('required');
    expect(result.parallelToolCalls).toBe(false);
    expect(result.extra).toEqual({ beta: true });

    const byName = ModelConfigSchema.parse({
      model: 'deepseek-chat',
      toolChoice: { type: 'function', function: { name: 'get_weather' } },
    });
    expect(byName.toolChoice).toEqual({ type: 'function', function: { name: 'get_weather' } });
  });

  it('非法 toolChoice 拒绝', () => {
    expect(ModelConfigSchema.safeParse({ model: 'm', toolChoice: 'bogus' }).success).toBe(false);
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
      expect(result.data.security.webSearch.provider).toBe('searxng');
      expect(result.data.security.webSearch.fallback).toBe('duckduckgo');
      expect(result.data.security.webSearch.maxResults).toBe(8);
    }
  });

  it('缺省 tools 时 disabled 为空数组', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'test-agent',
      model: { model: 'deepseek-chat' },
      systemPrompt: { template: 'hello' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tools.disabled).toEqual([]);
    }
  });

  it('tools.disabled 显式声明', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'test-agent',
      model: { model: 'deepseek-chat' },
      systemPrompt: { template: 'hello' },
      tools: { disabled: ['builtin.web_search'] },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tools.disabled).toEqual(['builtin.web_search']);
    }
  });

  it('缺省无 embedding', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'test-agent',
      model: { model: 'deepseek-chat' },
      systemPrompt: { template: 'hello' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.embedding).toBeUndefined();
    }
  });

  it('embedding 显式声明', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'test-agent',
      model: { model: 'deepseek-chat' },
      systemPrompt: { template: 'hello' },
      embedding: { baseURL: 'http://localhost/v1', model: 'text-embedding-3-small' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.embedding?.model).toBe('text-embedding-3-small');
      expect(result.data.embedding?.provider).toBe('openai-compatible');
    }
  });

  it('缺省 guardrails 为空数组', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'test-agent',
      model: { model: 'deepseek-chat' },
      systemPrompt: { template: 'hello' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.guardrails).toEqual([]);
    }
  });

  it('guardrails 显式声明一条 deny 规则', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'test-agent',
      model: { model: 'deepseek-chat' },
      systemPrompt: { template: 'hello' },
      guardrails: [{ id: 'deny-rm', denyTools: ['builtin.bash'], denyPatterns: ['rm -rf'] }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const rule = result.data.guardrails[0];
      expect(rule?.id).toBe('deny-rm');
      expect(rule?.on).toBe('beforeToolCall');
      expect(rule?.allowTools).toEqual([]);
      expect(rule?.denyTools).toEqual(['builtin.bash']);
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
