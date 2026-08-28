import { describe, expect, it } from '@rstest/core';
import { createResilientProvider, isRetryableError } from '../src/llm/resilient';
import type { ChatCompletionResult, LLMProvider } from '../src/llm/types';

function okProvider(name: string): { provider: LLMProvider; calls: () => number } {
  let count = 0;
  return {
    provider: {
      name,
      async chatCompletion(): Promise<ChatCompletionResult> {
        count += 1;
        return { message: { role: 'assistant', content: `${name}-ok` } };
      },
    },
    calls: () => count,
  };
}

function failProvider(
  name: string,
  error: unknown,
): { provider: LLMProvider; calls: () => number } {
  let count = 0;
  return {
    provider: {
      name,
      async chatCompletion(): Promise<ChatCompletionResult> {
        count += 1;
        throw error;
      },
    },
    calls: () => count,
  };
}

const retry = { maxRetries: 2, baseDelayMs: 0 };

describe('isRetryableError', () => {
  it('5xx / 429 可重试', () => {
    expect(isRetryableError({ status: 500 })).toBe(true);
    expect(isRetryableError({ status: 429 })).toBe(true);
    expect(isRetryableError({ status: 503 })).toBe(true);
  });

  it('4xx 不可重试', () => {
    expect(isRetryableError({ status: 400 })).toBe(false);
    expect(isRetryableError({ status: 401 })).toBe(false);
    expect(isRetryableError({ status: 404 })).toBe(false);
  });

  it('无 status（网络/未知）可重试', () => {
    expect(isRetryableError(new Error('network down'))).toBe(true);
  });
});

describe('createResilientProvider', () => {
  it('主模型成功 → 不 fallback', async () => {
    const a = okProvider('a');
    const b = okProvider('b');
    const provider = createResilientProvider([a.provider, b.provider], retry);
    const result = await provider.chatCompletion({ messages: [] });
    expect(result.message.content).toBe('a-ok');
    expect(a.calls()).toBe(1);
    expect(b.calls()).toBe(0);
  });

  it('主模型可重试失败 → 重试耗尽后 fallback 成功', async () => {
    const a = failProvider('a', { status: 500 });
    const b = okProvider('b');
    const provider = createResilientProvider([a.provider, b.provider], retry);
    const result = await provider.chatCompletion({ messages: [] });
    expect(result.message.content).toBe('b-ok');
    expect(a.calls()).toBe(3); // 1 次 + 2 次重试
    expect(b.calls()).toBe(1);
  });

  it('主模型不可重试（4xx）→ 不重试直接 fallback', async () => {
    const a = failProvider('a', { status: 400 });
    const b = okProvider('b');
    const provider = createResilientProvider([a.provider, b.provider], retry);
    const result = await provider.chatCompletion({ messages: [] });
    expect(result.message.content).toBe('b-ok');
    expect(a.calls()).toBe(1); // 不可重试，不重试
    expect(b.calls()).toBe(1);
  });

  it('全部失败 → 抛最后一个错误', async () => {
    const a = failProvider('a', { status: 500 });
    const b = failProvider('b', new Error('b-fail'));
    const provider = createResilientProvider([a.provider, b.provider], retry);
    await expect(provider.chatCompletion({ messages: [] })).rejects.toThrow('b-fail');
  });
});
