import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';
import { assembleAgentLoop } from '../src/agent/assemble';
import type { ContextContributor } from '../src/context/context-contributor';
import type { ChatMessage, LLMProvider } from '../src/llm/types';
import type { Plugin } from '../src/plugins/types';
import { ToolRegistry } from '../src/tools/registry';

function makeProvider(captured: ChatMessage[][]): LLMProvider {
  return {
    name: 'mock',
    async chatCompletion(params) {
      captured.push(params.messages);
      return { message: { role: 'assistant', content: 'done' } };
    },
  };
}

const tmpTool = {
  name: 'contributor_tool',
  description: '贡献者临时工具',
  inputSchema: z.object({}),
  execute: async () => ({ ok: true }),
};

describe('ContextContributor（统一扩展缝）', () => {
  it('插件注册 contributor：文本注入 + 工具临时注册、run 后还原', async () => {
    const registry = new ToolRegistry();
    const captured: ChatMessage[][] = [];
    const plugin: Plugin = {
      name: 'c-plugin',
      description: '贡献者插件',
      version: '1.0.0',
      install(ctx) {
        ctx.registerContextContributor({
          name: 'c1',
          async contribute({ userInput }) {
            return { text: `注入素材（来自 ${userInput}）`, tools: [tmpTool] };
          },
        });
      },
    };

    const { agent } = await assembleAgentLoop({
      provider: makeProvider(captured),
      registry,
      systemPrompt: '基础提示词',
      plugins: [plugin],
    });

    await agent.run('你好');

    const systemMsg = captured[0]?.find((m) => m.role === 'system');
    expect(systemMsg?.content).toContain('注入素材（来自 你好）');
    // run 结束后工具已还原，不跨 run 残留。
    expect(registry.has('contributor_tool')).toBe(false);
  });

  it('贡献者失败隔离：单个抛错不影响 run 与其余贡献者', async () => {
    const registry = new ToolRegistry();
    const captured: ChatMessage[][] = [];
    const good: ContextContributor = {
      name: 'good',
      async contribute() {
        return { text: '正常素材' };
      },
    };
    const bad: ContextContributor = {
      name: 'bad',
      async contribute() {
        throw new Error('boom');
      },
    };

    const { agent } = await assembleAgentLoop({
      provider: makeProvider(captured),
      registry,
      systemPrompt: '基础提示词',
      plugins: [
        {
          name: 'p',
          description: 'x',
          version: '1.0.0',
          install(ctx) {
            ctx.registerContextContributor(bad);
            ctx.registerContextContributor(good);
          },
        },
      ],
    });

    await agent.run('hi');

    const systemMsg = captured[0]?.find((m) => m.role === 'system');
    expect(systemMsg?.content).toContain('正常素材');
  });
});
