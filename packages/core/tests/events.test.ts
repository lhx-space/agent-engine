import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';
import { assembleAgentLoop } from '../src/agent/assemble';
import { EventBus } from '../src/events/event-bus';
import type { AgentEngineEvent } from '../src/events/types';
import { ToolRegistry } from '../src/tools/registry';

describe('EventBus', () => {
  it('on/emit + 取消订阅', () => {
    const bus = new EventBus();
    const got: AgentEngineEvent[] = [];
    const off = bus.on((event) => got.push(event));
    bus.emit({ type: 'custom', name: 'x' });
    off();
    bus.emit({ type: 'custom', name: 'y' });
    expect(got.map((event) => event.type)).toEqual(['custom']);
  });

  it('custom 逃生舱透传 data', () => {
    const bus = new EventBus();
    let data: unknown;
    bus.on((event) => {
      if (event.type === 'custom') data = event.data;
    });
    bus.emit({ type: 'custom', name: 'progress', data: { percent: 50 } });
    expect(data).toEqual({ percent: 50 });
  });
});

describe('assembleAgentLoop 装配期事件', () => {
  it('发 plugin.installed / tool.registered', async () => {
    const bus = new EventBus();
    const events: AgentEngineEvent[] = [];
    bus.on((event) => events.push(event));

    const registry = new ToolRegistry();
    await assembleAgentLoop({
      provider: {
        name: 'mock',
        async chatCompletion() {
          return { message: { role: 'assistant', content: 'ok' } };
        },
      },
      registry,
      systemPrompt: 'hi',
      plugins: [
        {
          name: 'p1',
          description: '测试插件',
          version: '1.0.0',
          install(ctx) {
            ctx.registerTool({
              name: 't1',
              description: 'd',
              inputSchema: z.object({}),
              execute: async () => ({}),
            });
          },
        },
      ],
      eventBus: bus,
    });

    expect(events.some((event) => event.type === 'plugin.installed' && event.name === 'p1')).toBe(
      true,
    );
    expect(events.some((event) => event.type === 'tool.registered' && event.name === 't1')).toBe(
      true,
    );
  });
});
