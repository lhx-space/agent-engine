import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';
import { AgentLoop } from '../src/agent/loop';
import type { AgentRunEvent } from '../src/agent/types';
import { EventBus } from '../src/events/event-bus';
import type { LLMProvider } from '../src/llm/types';
import { ToolRegistry } from '../src/tools/registry';

/** 首次返回一个工具调用，随后返回最终答案。 */
function makeToolCallProvider(): LLMProvider {
  let calls = 0;
  return {
    name: 'mock',
    async chatCompletion() {
      calls += 1;
      if (calls === 1) {
        return {
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [{ id: 'c1', type: 'function', function: { name: 't1', arguments: '{}' } }],
          },
        };
      }
      return { message: { role: 'assistant', content: 'done' } };
    },
  };
}

describe('流式 custom 事件', () => {
  it('事件总线 custom 转发到 onEvent', async () => {
    const bus = new EventBus();
    const registry = new ToolRegistry();
    const loop = new AgentLoop({
      provider: {
        name: 'mock',
        async chatCompletion() {
          return { message: { role: 'assistant', content: 'ok' } };
        },
      },
      registry,
      systemPrompt: 'hi',
      eventBus: bus,
    });

    const events: AgentRunEvent[] = [];
    const runPromise = loop.run('hi', { onEvent: (event) => events.push(event) });
    bus.emit({ type: 'custom', name: 'progress', data: { percent: 50 } });
    await runPromise;

    expect(events.some((event) => event.type === 'custom' && event.name === 'progress')).toBe(true);
  });
});

describe('Human-in-the-loop 审批', () => {
  it('approveToolCall 拒绝阻断工具，原因回填给模型', async () => {
    const registry = new ToolRegistry();
    let executed = false;
    registry.register({
      name: 't1',
      description: 'd',
      inputSchema: z.object({}),
      execute: async () => {
        executed = true;
        return { ok: true };
      },
    });

    const loop = new AgentLoop({
      provider: makeToolCallProvider(),
      registry,
      systemPrompt: 'hi',
    });
    const result = await loop.run('hi', {
      approveToolCall: async () => ({ approved: false, reason: '不允许执行' }),
    });

    expect(executed).toBe(false);
    expect(
      result.messages.some(
        (message) => message.role === 'tool' && message.content.includes('不允许执行'),
      ),
    ).toBe(true);
  });

  it('approveToolCall 放行则执行工具', async () => {
    const registry = new ToolRegistry();
    let executed = false;
    registry.register({
      name: 't1',
      description: 'd',
      inputSchema: z.object({}),
      execute: async () => {
        executed = true;
        return { ok: true };
      },
    });

    const loop = new AgentLoop({
      provider: makeToolCallProvider(),
      registry,
      systemPrompt: 'hi',
    });
    await loop.run('hi', { approveToolCall: async () => ({ approved: true }) });

    expect(executed).toBe(true);
  });
});
