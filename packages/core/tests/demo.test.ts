import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';
import { assembleAgentLoop } from '../src/agent/assemble';
import type { ChatCompletionResult, ChatMessage, LLMProvider } from '../src/llm/types';
import { ConversationMemory } from '../src/memory/conversation-memory';
import type { Plugin } from '../src/plugins/types';
import { ToolRegistry } from '../src/tools/registry';

/**
 * 端到端可观测 demo：mock LLM 跑通完整 Agent，
 * 用 console.log 打印「装配(plugin) → 检索(rules/skills) → 工具执行 → 多轮回答」全流程。
 * 运行：pnpm test demo
 */
describe('端到端 demo（可观测）', () => {
  it('plugin 装配 → rules/skills 检索 → 工具 → 多轮回答', async () => {
    // 1. 空工具注册表（tool 由 plugin 注入）
    const registry = new ToolRegistry();

    // 2. 一个 plugin：注入 weather 工具 + prompt 片段
    const weatherPlugin: Plugin = {
      name: 'weather-plugin',
      description: '天气查询与穿衣建议',
      version: '1.0.0',
      install(ctx) {
        ctx.registerTool({
          name: 'get_weather',
          description: '查询城市天气',
          inputSchema: z.object({ city: z.string() }),
          execute: async (input: { city: string }) => ({
            city: input.city,
            temp: 22,
            condition: '晴',
          }),
        });
        ctx.provideSystemPrompt('你擅长天气查询，并给出穿衣建议。');
      },
    };

    // 3. mock LLM：第 1 轮返回 tool_call，第 2 轮起返回最终回答
    const weatherCall: ChatMessage = {
      role: 'assistant',
      content: '',
      toolCalls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'get_weather', arguments: '{"city":"北京"}' },
        },
      ],
    };
    const responses: ChatCompletionResult[] = [
      { message: weatherCall },
      { message: { role: 'assistant', content: '北京今天 22 度，晴，适合穿薄外套。' } },
    ];
    let callIndex = 0;
    const provider: LLMProvider = {
      name: 'mock-deepseek',
      async chatCompletion(params) {
        const r = responses[Math.min(callIndex, responses.length - 1)];
        callIndex += 1;
        console.log(`\n── LLM 调用 #${callIndex}（发送 ${params.messages.length} 条消息）──`);
        for (const m of params.messages) {
          const preview = m.content.replace(/\n/g, ' ⏎ ').slice(0, 160);
          console.log(`  [${m.role}] ${preview}${m.content.length > 160 ? '…' : ''}`);
        }
        if (params.tools?.length) {
          console.log(
            '  可用工具:',
            params.tools.map((t) => t.function.name),
          );
        }
        return r;
      },
    };

    // 4. 装配：plugin + 声明式 rules + skills + memory
    const memory = new ConversationMemory({ maxMessages: 10 });
    const loop = await assembleAgentLoop({
      provider,
      registry,
      systemPrompt: {
        template: '你是 {{role}}。\n\n规则：\n{{rules}}\n\n技能：\n{{skills}}',
        variables: { role: '天气助手' },
      },
      rules: [
        { id: 'r-concise', kind: 'always', description: '简洁', content: '回答要简洁', tags: [] },
        {
          id: 'r-weather-format',
          kind: 'on-demand',
          description: '天气回答格式规范',
          content: '报温度时注明摄氏度单位。',
          tags: ['天气'],
        },
      ],
      skills: [
        {
          id: 'weather-qa',
          description: '天气查询与穿衣建议',
          instruction: '查询天气后，给出对应穿衣建议。',
          tags: ['天气', '穿衣'],
        },
      ],
      plugins: [weatherPlugin],
      memory,
    });

    console.log('\n========== 第一轮 ==========');
    const r1 = await loop.run('北京今天天气怎么样？');
    console.log('\n>> 第一轮最终回答:', r1.finalMessage.content);
    console.log('>> 步数:', r1.steps);

    console.log('\n========== 第二轮（多轮记忆） ==========');
    const r2 = await loop.run('那适合穿什么？');
    console.log('\n>> 第二轮最终回答:', r2.finalMessage.content);
    console.log('>> 会话记忆条数:', memory.size);

    expect(registry.has('get_weather')).toBe(true);
    expect(r1.finalMessage.content).toContain('22');
    expect(r2.steps).toBeGreaterThan(0);
  });
});
