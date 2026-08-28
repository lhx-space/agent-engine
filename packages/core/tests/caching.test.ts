import { describe, expect, it } from '@rstest/core';
import { InMemoryCacheBackend } from '../src/cache/cache-backend';
import { createCachingProvider } from '../src/llm/caching';
import type { ChatCompletionResult, LLMProvider } from '../src/llm/types';

function countingProvider(): { provider: LLMProvider; calls: () => number } {
  let count = 0;
  return {
    provider: {
      name: 'mock',
      async chatCompletion(): Promise<ChatCompletionResult> {
        count += 1;
        return { message: { role: 'assistant', content: `answer-${count}` } };
      },
    },
    calls: () => count,
  };
}

const messages = [{ role: 'user' as const, content: '你好' }];

describe('createCachingProvider', () => {
  it('首次调用 → 调 provider 并写缓存', async () => {
    const { provider, calls } = countingProvider();
    const cached = createCachingProvider(provider, new InMemoryCacheBackend());
    const result = await cached.chatCompletion({ messages });
    expect(result.message.content).toBe('answer-1');
    expect(calls()).toBe(1);
  });

  it('相同参数第二次 → 命中缓存，不再调 provider', async () => {
    const { provider, calls } = countingProvider();
    const cached = createCachingProvider(provider, new InMemoryCacheBackend());
    await cached.chatCompletion({ messages });
    const result = await cached.chatCompletion({ messages });
    expect(result.message.content).toBe('answer-1'); // 仍是第一次的结果
    expect(calls()).toBe(1); // 未重复调用
  });

  it('不同参数 → 不命中缓存', async () => {
    const { provider, calls } = countingProvider();
    const cached = createCachingProvider(provider, new InMemoryCacheBackend());
    await cached.chatCompletion({ messages });
    await cached.chatCompletion({ messages: [{ role: 'user', content: '另一个问题' }] });
    expect(calls()).toBe(2);
  });
});
