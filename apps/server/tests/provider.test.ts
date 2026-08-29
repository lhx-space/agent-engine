import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import { resolveEnvApiKey } from '../src/infra/provider';

describe('resolveEnvApiKey（部署层环境变量映射）', () => {
  beforeEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('openai-compatible 优先取 DEEPSEEK_API_KEY', () => {
    process.env.DEEPSEEK_API_KEY = 'deepseek-key';
    process.env.OPENAI_API_KEY = 'openai-key';
    expect(resolveEnvApiKey('openai-compatible')).toBe('deepseek-key');
  });

  it('openai-compatible 无 DEEPSEEK 时回退 OPENAI_API_KEY', () => {
    process.env.OPENAI_API_KEY = 'openai-key';
    expect(resolveEnvApiKey('openai-compatible')).toBe('openai-key');
  });

  it('custom 同样走 OpenAI 兼容环境变量', () => {
    process.env.OPENAI_API_KEY = 'openai-key';
    expect(resolveEnvApiKey('custom')).toBe('openai-key');
  });

  it('anthropic 取 ANTHROPIC_API_KEY', () => {
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    expect(resolveEnvApiKey('anthropic')).toBe('anthropic-key');
  });

  it('无任何环境变量时返回 undefined', () => {
    expect(resolveEnvApiKey('openai-compatible')).toBeUndefined();
  });
});
