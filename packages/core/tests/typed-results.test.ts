import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';
import { AgentLoop } from '../src/agent/loop';
import { CompletionError } from '../src/llm/types';
import type { LLMProvider } from '../src/llm/types';
import { ToolRegistry } from '../src/tools/registry';

function makeRegistry() {
  const registry = new ToolRegistry();
  registry.register({
    name: 't1',
    description: 'd',
    inputSchema: z.object({}),
    execute: async () => ({ ok: true }),
  });
  return registry;
}

function toolCallProvider(): LLMProvider {
  return {
    name: 'mock',
    async chatCompletion() {
      return {
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'c1', type: 'function', function: { name: 't1', arguments: '{}' } }],
        },
      };
    },
  };
}

describe('类型化结果（FinishReason / outcome / CompletionError）', () => {
  it('自然结束：outcome = completed', async () => {
    const loop = new AgentLoop({
      provider: {
        name: 'mock',
        async chatCompletion() {
          return { message: { role: 'assistant', content: 'done' }, finishReason: 'stop' };
        },
      },
      registry: makeRegistry(),
      systemPrompt: 'hi',
    });
    const result = await loop.run('hi');
    expect(result.outcome.kind).toBe('completed');
    expect(result.finishReason).toBe('stop');
  });

  it('撞 maxSteps：outcome = max_steps', async () => {
    const loop = new AgentLoop({
      provider: toolCallProvider(),
      registry: makeRegistry(),
      systemPrompt: 'hi',
      execution: { maxSteps: 1 },
    });
    const result = await loop.run('hi');
    expect(result.outcome.kind).toBe('max_steps');
  });

  it('超时：outcome = timeout', async () => {
    const loop = new AgentLoop({
      provider: {
        name: 'mock',
        async chatCompletion() {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return {
            message: {
              role: 'assistant',
              content: '',
              toolCalls: [
                { id: 'c1', type: 'function', function: { name: 't1', arguments: '{}' } },
              ],
            },
          };
        },
      },
      registry: makeRegistry(),
      systemPrompt: 'hi',
      execution: { timeoutMs: 1, maxSteps: 10 },
    });
    const result = await loop.run('hi');
    expect(result.outcome.kind).toBe('timeout');
  });

  it('provider 失败：包装为 CompletionError', async () => {
    const loop = new AgentLoop({
      provider: {
        name: 'mock',
        async chatCompletion() {
          throw new Error('boom');
        },
      },
      registry: makeRegistry(),
      systemPrompt: 'hi',
    });
    const error = await loop.run('hi').catch((err: unknown) => err);
    expect(error).toBeInstanceOf(CompletionError);
    expect((error as CompletionError).cause).toBeInstanceOf(Error);
    expect(((error as CompletionError).cause as Error).message).toBe('boom');
  });
});
