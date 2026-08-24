import { describe, expect, it, rs } from '@rstest/core';
import { AgentConfigSchema } from '@agent-engine/config';
import { AgentLoop } from '../src/agent/loop';
import { HookPipeline } from '../src/hooks/pipeline';
import type { LLMProvider } from '../src/llm/types';
import { ConversationMemory } from '../src/memory/conversation-memory';
import { resolveAgentConfig } from '../src/resolve/resolve';
import { ToolRegistry } from '../src/tools/registry';

function makeProvider(): LLMProvider {
  return {
    name: 'mock',
    async chatCompletion() {
      return { message: { role: 'assistant', content: 'ok' } };
    },
  };
}

describe('HookPipeline 会话级 hook', () => {
  it('onInit/onSessionStart/onSessionEnd 链式执行并产出 trace', async () => {
    const hooks = new HookPipeline();
    const onInit = rs.fn();
    const onSessionStart = rs.fn();
    const onSessionEnd = rs.fn();
    const traces: string[] = [];
    hooks.onTrace((t) => traces.push(t.point));
    hooks.register({ name: 'h', onInit, onSessionStart, onSessionEnd });

    await hooks.onInit();
    await hooks.onSessionStart();
    await hooks.onSessionEnd();

    expect(onInit).toHaveBeenCalledTimes(1);
    expect(onSessionStart).toHaveBeenCalledTimes(1);
    expect(onSessionEnd).toHaveBeenCalledTimes(1);
    expect(traces).toEqual(['onInit', 'onSessionStart', 'onSessionEnd']);
  });

  it('未实现会话级方法的 hook 被跳过', async () => {
    const hooks = new HookPipeline();
    hooks.register({ name: 'h' });

    await hooks.onInit();
    await hooks.onSessionStart();
    await hooks.onSessionEnd();
  });
});

describe('AgentLoop 会话边界', () => {
  it('首次 run 触发 onSessionStart（仅一次）', async () => {
    const hooks = new HookPipeline();
    const onSessionStart = rs.fn();
    hooks.register({ name: 'h', onSessionStart });

    const loop = new AgentLoop({
      provider: makeProvider(),
      registry: new ToolRegistry(),
      systemPrompt: 's',
      hooks,
    });

    await loop.run('1');
    await loop.run('2');

    expect(onSessionStart).toHaveBeenCalledTimes(1);
  });

  it('endSession 触发 onSessionEnd 并清空 memory（幂等）', async () => {
    const hooks = new HookPipeline();
    const onSessionEnd = rs.fn();
    hooks.register({ name: 'h', onSessionEnd });
    const memory = new ConversationMemory();

    const loop = new AgentLoop({
      provider: makeProvider(),
      registry: new ToolRegistry(),
      systemPrompt: 's',
      hooks,
      memory,
    });

    await loop.run('1');
    expect(memory.size).toBe(2); // user + assistant

    await loop.endSession();
    expect(onSessionEnd).toHaveBeenCalledTimes(1);
    expect(memory.size).toBe(0);

    await loop.endSession();
    expect(onSessionEnd).toHaveBeenCalledTimes(1);
  });
});

describe('resolveAgentConfig onInit', () => {
  it('装配完成触发 onInit', async () => {
    const config = AgentConfigSchema.parse({
      name: 't',
      model: { provider: 'custom', baseURL: 'http://localhost', model: 'mock' },
      systemPrompt: { template: 's' },
      plugins: ['p'],
    });

    const onInit = rs.fn();
    const resolved = await resolveAgentConfig(config, {
      providerFactory: () => makeProvider(),
      pluginFactories: {
        p: () => ({
          name: 'p',
          description: '测试插件',
          version: '1.0.0',
          install(ctx) {
            ctx.registerHook({ name: 'h', onInit });
          },
        }),
      },
    });

    expect(onInit).toHaveBeenCalledTimes(1);
    await resolved.dispose();
  });
});
