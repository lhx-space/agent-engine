import { describe, expect, it } from '@rstest/core';
import { AgentConfigSchema } from '@lhx-agent-engine/config';
import { TokenBudgetCompactor } from '../src/context/compactor';
import { ApproximateTokenCounter } from '../src/context/token-counter';
import type { TokenCounter } from '../src/context/token-counter';
import type { ChatMessage } from '../src/llm/types';
import type { LLMProvider } from '../src/llm/types';
import { IdentityReranker } from '../src/retrieval/reranker';
import type { Reranker } from '../src/retrieval/reranker';
import { resolveAgentConfig } from '../src/resolve/resolve';

function makeProvider(): LLMProvider {
  return {
    name: 'mock',
    async chatCompletion() {
      return { message: { role: 'assistant', content: 'ok' } };
    },
  };
}

describe('ApproximateTokenCounter', () => {
  it('字符数 / 4 粗估', () => {
    const counter = new ApproximateTokenCounter();
    expect(counter.count('abcd')).toBe(1);
    expect(counter.count('abcdefgh')).toBe(2);
  });
});

describe('TokenBudgetCompactor', () => {
  const counter: TokenCounter = { name: 'chars', count: (text) => text.length };

  it('按 token 预算保留最近整轮，不拆 tool_call 配对', async () => {
    const compactor = new TokenBudgetCompactor(counter);
    const messages: ChatMessage[] = [
      { role: 'user', content: 'a'.repeat(10) },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'c1', type: 'function', function: { name: 't1', arguments: '{}' } }],
      },
      { role: 'tool', content: 'result', toolCallId: 'c1', name: 't1' },
      { role: 'user', content: 'b'.repeat(5) },
      { role: 'assistant', content: 'c'.repeat(3) },
    ];
    // 预算 8：最后一轮（5+3=8）刚好放下，第一轮（10+0+6=16）被淘汰。
    const kept = await compactor.compact(messages, 8);
    expect(kept).toHaveLength(2);
    expect(kept[0]?.role).toBe('user');
    expect(kept[0]?.content).toBe('b'.repeat(5));
  });

  it('单轮超预算时至少保留最后一轮', async () => {
    const compactor = new TokenBudgetCompactor(counter);
    const messages: ChatMessage[] = [
      { role: 'user', content: 'a'.repeat(20) },
      { role: 'assistant', content: 'b'.repeat(20) },
    ];
    const kept = await compactor.compact(messages, 5);
    expect(kept).toHaveLength(2);
  });
});

describe('IdentityReranker', () => {
  it('保持原序', async () => {
    const reranker = new IdentityReranker();
    const candidates = [
      { id: 'a', score: 2 },
      { id: 'b', score: 1 },
    ];
    expect(await reranker.rerank('q', candidates)).toEqual(candidates);
  });
});

describe('resolveAgentConfig 上下文/检索接口解析', () => {
  it('缺省默认', async () => {
    const config = AgentConfigSchema.parse({
      name: 't',
      model: { provider: 'custom', baseURL: 'http://localhost', model: 'mock' },
      systemPrompt: { template: 'hi' },
    });
    const resolved = await resolveAgentConfig(config, { providerFactory: () => makeProvider() });
    expect(resolved.tokenCounter.name).toBe('approximate');
    expect(resolved.contextCompactor.name).toBe('token-budget');
    expect(resolved.retriever.name).toBe('none');
    expect(resolved.reranker.name).toBe('identity');
    await resolved.dispose();
  });

  it('插件注册自定义 tokenCounter / reranker', async () => {
    const customCounter: TokenCounter = { name: 'tiktoken', count: (t) => t.length };
    const customReranker: Reranker = {
      name: 'llm',
      async rerank(_q, candidates) {
        return candidates.slice().reverse();
      },
    };
    const config = AgentConfigSchema.parse({
      name: 't',
      model: { provider: 'custom', baseURL: 'http://localhost', model: 'mock' },
      systemPrompt: { template: 'hi' },
      plugins: ['ctx-plugin'],
    });
    const resolved = await resolveAgentConfig(config, {
      providerFactory: () => makeProvider(),
      pluginFactories: {
        'ctx-plugin': () => ({
          name: 'ctx-plugin',
          description: '测试上下文插件',
          version: '1.0.0',
          install(ctx) {
            ctx.registerTokenCounter(customCounter);
            ctx.registerReranker(customReranker);
          },
        }),
      },
    });
    expect(resolved.tokenCounter.name).toBe('tiktoken');
    expect(resolved.reranker.name).toBe('llm');
    await resolved.dispose();
  });
});
