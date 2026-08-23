import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AgentLoop } from '../src/agent/loop';
import type { ChatCompletionResult, ChatMessage, LLMProvider } from '../src/llm/types';
import { ConversationMemory } from '../src/memory/conversation-memory';
import { ToolRegistry } from '../src/tools/registry';

/**
 * 端到端可观测 demo：mock LLM 跑通完整 Agent，
 * 用 console.log 打印「检索 → 组装 → 工具执行 → 回答」全流程。
 * 运行：pnpm test demo
 */
describe('端到端 demo（可观测）', () => {
  it('检索 → 组装 → 工具 → 多轮回答', async () => {
    // 1. 内置工具
    const registry = new ToolRegistry();
    registry.register({
      name: 'get_weather',
      description: '查询城市天气',
      inputSchema: z.object({ city: z.string() }),
      execute: async (input: { city: string }) => ({ city: input.city, temp: 22, condition: '晴' }),
    });

    // 2. mock LLM：第 1 轮返回 tool_call，第 2 轮起返回最终回答
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
          const preview = m.content.replace(/\n/g, ' ⏎ ').slice(0, 140);
          console.log(`  [${m.role}] ${preview}${m.content.length > 140 ? '…' : ''}`);
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

    // 3. 声明式配置：模板 + rules + skills + memory
    const memory = new ConversationMemory({ maxMessages: 10 });
    const loop = new AgentLoop({
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

    expect(r1.finalMessage.content).toContain('22');
    expect(r2.steps).toBeGreaterThan(0);
  });
});
