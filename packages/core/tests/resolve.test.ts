import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';
import { AgentConfigSchema, type AgentConfig } from '@agent-engine/config';
import { mergeBundles } from '../src/capability/bundle';
import type { CapabilityBundle } from '../src/capability/types';
import type { ChatMessage, LLMProvider } from '../src/llm/types';
import { resolveAgentConfig } from '../src/resolve/resolve';

function makeProvider(capturedTools?: string[][]): LLMProvider {
  return {
    name: 'mock',
    async chatCompletion(params) {
      capturedTools?.push((params.tools ?? []).map((tool) => tool.function.name));
      return { message: { role: 'assistant', content: 'ok' } };
    },
  };
}

function baseConfig(): AgentConfig {
  return AgentConfigSchema.parse({
    name: 'test-agent',
    model: { provider: 'custom', baseURL: 'http://localhost', model: 'mock' },
    systemPrompt: { template: '你是助手', variables: {} },
  });
}

describe('mergeBundles', () => {
  it('合并 tools/hooks + dispose 聚合', async () => {
    const disposed: string[] = [];
    const b1: CapabilityBundle = {
      tools: [
        { name: 't1', description: 'd', inputSchema: z.object({}), execute: async () => ({}) },
      ],
      toolSources: [],
      hooks: [],
      guardrails: [],
      promptFragments: ['p1'],
      memoryBackends: [],
      cacheBackends: [],
      vectorStores: [],
      embeddingProviders: [],
      tokenCounters: [],
      contextCompactors: [],
      retrievers: [],
      rerankers: [],
      summarizers: [],
      contextContributors: [],
      dispose: async () => {
        disposed.push('a');
      },
    };
    const b2: CapabilityBundle = {
      tools: [],
      toolSources: [],
      hooks: [],
      guardrails: [],
      promptFragments: [],
      memoryBackends: [],
      cacheBackends: [],
      vectorStores: [],
      embeddingProviders: [],
      tokenCounters: [],
      contextCompactors: [],
      retrievers: [],
      rerankers: [],
      summarizers: [],
      contextContributors: [],
      dispose: async () => {
        disposed.push('b');
      },
    };

    const merged = mergeBundles([b1, b2]);
    expect(merged.tools.map((tool) => tool.name)).toEqual(['t1']);
    expect(merged.promptFragments).toEqual(['p1']);

    await merged.dispose();
    expect(disposed.sort()).toEqual(['a', 'b']);
  });
});

describe('resolveAgentConfig', () => {
  it('完整配置装配：内置工具 + plugin 工具 + run 可用', async () => {
    const config = baseConfig();
    config.plugins = ['test-plugin'];

    const capturedTools: string[][] = [];
    const resolved = await resolveAgentConfig(config, {
      providerFactory: () => makeProvider(capturedTools),
      pluginFactories: {
        'test-plugin': () => ({
          name: 'test-plugin',
          description: '测试插件',
          version: '1.0.0',
          install(ctx) {
            ctx.registerTool({
              name: 'plugin_tool',
              description: '插件工具',
              inputSchema: z.object({}),
              execute: async () => 'from-plugin',
            });
          },
        }),
      },
    });

    const result = await resolved.agent.run('hi');
    expect(result.finalMessage.content).toBe('ok');

    // 内置 todo（恒注册）+ 插件工具都进入了 LLM 的工具列表（function.name 为 LLM 合法名）。
    const tools = capturedTools[0] ?? [];
    expect(tools).toContain('builtin_todo');
    expect(tools).toContain('plugin_tool');

    // dispose 幂等（无 mcp 时为无副作用）。
    await resolved.dispose();
    await resolved.dispose();
  });

  it('plugin 名缺失报错', async () => {
    const config = baseConfig();
    config.plugins = ['missing-plugin'];

    await expect(
      resolveAgentConfig(config, { providerFactory: () => makeProvider() }),
    ).rejects.toThrow(/missing-plugin/);
  });

  it('tools.disabled 禁用内置工具（todo 不进入 LLM 工具列表）', async () => {
    const config = baseConfig();
    config.tools = { disabled: ['builtin.todo'] };

    const capturedTools: string[][] = [];
    const resolved = await resolveAgentConfig(config, {
      providerFactory: () => makeProvider(capturedTools),
    });

    await resolved.agent.run('hi');
    await resolved.dispose();

    const tools = capturedTools[0] ?? [];
    expect(tools).not.toContain('builtin_todo');
    expect(tools).toContain('builtin_datetime');
  });

  it('memory.session.maxTokens + summary 经 resolve 装配（单轮不触发摘要也不报错）', async () => {
    const config = baseConfig();
    config.memory = { session: { maxTokens: 50, summary: true } };

    const resolved = await resolveAgentConfig(config, {
      providerFactory: () => makeProvider(),
    });

    const result = await resolved.agent.run('hi');
    await resolved.dispose();

    expect(result.finalMessage.content).toBe('ok');
  });

  it('plugin 注册的 guardrail 阻断工具调用（resolve 装配进循环）', async () => {
    const config = baseConfig();
    config.plugins = ['guardrail-plugin'];

    let calls = 0;
    const provider: LLMProvider = {
      name: 'mock',
      async chatCompletion() {
        calls += 1;
        if (calls === 1) {
          return {
            message: {
              role: 'assistant',
              content: '',
              toolCalls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'builtin_todo', arguments: '{}' },
                },
              ],
            },
          };
        }
        return { message: { role: 'assistant', content: 'done' } };
      },
    };

    const resolved = await resolveAgentConfig(config, {
      providerFactory: () => provider,
      pluginFactories: {
        'guardrail-plugin': () => ({
          name: 'guardrail-plugin',
          description: '测试 guardrail 插件',
          version: '1.0.0',
          install(ctx) {
            ctx.registerGuardrail({
              id: 'deny-todo',
              on: 'beforeToolCall',
              validate: async (context) =>
                context.toolName === 'builtin.todo'
                  ? { allowed: false, reason: 'denied tool "builtin.todo"' }
                  : { allowed: true },
            });
          },
        }),
      },
    });
    const result = await resolved.agent.run('hi');
    await resolved.dispose();

    const toolMsg = result.messages.find((m) => m.role === 'tool');
    expect(toolMsg?.content).toContain('Blocked:');
    expect(result.finalMessage.content).toBe('done');
  });
});
