import { describe, expect, it } from '@rstest/core';
import { createRoutingProvider } from '../src/llm/routing';
import type { ChatCompletionResult, LLMProvider } from '../src/llm/types';

function namedProvider(name: string): { provider: LLMProvider; calls: () => number } {
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

describe('createRoutingProvider', () => {
  it('无命中 → 默认 provider', async () => {
    const d = namedProvider('default');
    const r = namedProvider('reasoning');
    const provider = createRoutingProvider(d.provider, [
      { name: 'reasoning', provider: r.provider, when: { minInputTokens: 1000 } },
    ]);
    const result = await provider.chatCompletion({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result.message.content).toBe('default-ok');
    expect(d.calls()).toBe(1);
    expect(r.calls()).toBe(0);
  });

  it('输入 token 超阈值 → 命中复杂度路由', async () => {
    const d = namedProvider('default');
    const r = namedProvider('reasoning');
    const provider = createRoutingProvider(d.provider, [
      { name: 'reasoning', provider: r.provider, when: { minInputTokens: 10 } },
    ]);
    const longText = 'x'.repeat(100); // 100 字符 ≈ 25 token
    const result = await provider.chatCompletion({
      messages: [{ role: 'user', content: longText }],
    });
    expect(result.message.content).toBe('reasoning-ok');
    expect(r.calls()).toBe(1);
    expect(d.calls()).toBe(0);
  });

  it('能力标签命中 → 命中能力路由', async () => {
    const d = namedProvider('default');
    const v = namedProvider('vision');
    const provider = createRoutingProvider(d.provider, [
      { name: 'vision', provider: v.provider, when: { capabilities: ['vision'] } },
    ]);
    const result = await provider.chatCompletion({
      messages: [{ role: 'user', content: '描述这张图' }],
      capabilities: ['vision'],
    });
    expect(result.message.content).toBe('vision-ok');
    expect(v.calls()).toBe(1);
    expect(d.calls()).toBe(0);
  });
});
