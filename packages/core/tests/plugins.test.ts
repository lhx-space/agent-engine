import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';
import { assembleAgentLoop } from '../src/agent/assemble';
import type { ChatMessage, LLMProvider } from '../src/llm/types';
import { PluginManager } from '../src/plugins/manager';
import type { Plugin } from '../src/plugins/types';
import { ToolRegistry } from '../src/tools/registry';

describe('PluginManager', () => {
  it('收集 plugin 注入的能力', async () => {
    const plugin: Plugin = {
      name: 'test-plugin',
      description: '测试插件',
      version: '1.0.0',
      install(ctx) {
        ctx.registerTool({
          name: 't1',
          description: 'tool',
          inputSchema: z.object({}),
          execute: async () => ({}),
        });
        ctx.registerRule({
          id: 'r1',
          kind: 'always',
          description: '规则',
          content: '规则内容',
          tags: [],
        });
        ctx.registerGuardrail({
          id: 'g1',
          on: 'beforeToolCall',
          validate: async () => ({ allowed: true }),
        });
        ctx.registerSummarizer({ name: 'mock', summarize: async () => '摘要' });
        ctx.provideSystemPrompt('插件提示片段');
      },
    };

    const manager = new PluginManager();
    await manager.install(plugin);
    const a = manager.getAssembly();

    console.log(
      '\n[PluginManager] 收集结果：',
      JSON.stringify(
        {
          tools: a.tools.map((t) => t.name),
          rules: a.rules.map((r) => r.id),
          guardrails: a.guardrails.map((g) => g.id),
          summarizers: a.summarizers.map((s) => s.name),
          promptFragments: a.promptFragments,
        },
        null,
        2,
      ),
    );

    expect(a.tools).toHaveLength(1);
    expect(a.rules).toHaveLength(1);
    expect(a.guardrails.map((g) => g.id)).toEqual(['g1']);
    expect(a.summarizers.map((s) => s.name)).toEqual(['mock']);
    expect(a.promptFragments).toEqual(['插件提示片段']);
  });
});

describe('assembleAgentLoop', () => {
  it('plugin 注册的 tool 生效 + prompt 片段注入', async () => {
    const registry = new ToolRegistry();
    const captured: ChatMessage[][] = [];
    const provider: LLMProvider = {
      name: 'mock',
      async chatCompletion(params) {
        captured.push(params.messages);
        return { message: { role: 'assistant', content: 'done' } };
      },
    };

    const plugin: Plugin = {
      name: 'weather-plugin',
      description: '天气能力',
      version: '1.0.0',
      install(ctx) {
        ctx.registerTool({
          name: 'get_weather',
          description: '查询天气',
          inputSchema: z.object({ city: z.string() }),
          execute: async (input: { city: string }) => ({ city: input.city, temp: 20 }),
        });
        ctx.provideSystemPrompt('你是天气助手。');
      },
    };

    const { agent: loop } = await assembleAgentLoop({
      provider,
      registry,
      systemPrompt: '基础提示词',
      plugins: [plugin],
    });

    await loop.run('北京天气');

    const systemMsg = captured[0]?.find((m) => m.role === 'system');
    console.log('\n[assembleAgentLoop] system prompt：\n' + systemMsg?.content);
    console.log(
      '[assembleAgentLoop] 注册的工具:',
      registry.list().map((t) => t.name),
    );

    expect(registry.has('get_weather')).toBe(true);
    expect(systemMsg?.content).toContain('基础提示词');
    expect(systemMsg?.content).toContain('你是天气助手');
  });
});
