import { describe, expect, it, rs } from '@rstest/core';
import { z } from 'zod';
import { AgentLoop } from '../src/agent/loop';
import { HookPipeline } from '../src/hooks/pipeline';
import { ConversationMemory } from '../src/memory/conversation-memory';
import type { ChatCompletionResult, ChatMessage, LLMProvider } from '../src/llm/types';
import { ToolRegistry } from '../src/tools/registry';

/** 按顺序返回响应，最后一个响应无限重复（便于测试 maxSteps 兜底）。 */
function makeProvider(responses: ChatCompletionResult[]): LLMProvider {
  let i = 0;
  return {
    name: 'mock',
    async chatCompletion() {
      const r = responses[Math.min(i, responses.length - 1)];
      i += 1;
      return r as ChatCompletionResult;
    },
  };
}

function makeWeatherTool() {
  return {
    name: 'get_weather',
    description: 'Get weather for a city',
    inputSchema: z.object({ city: z.string() }),
    execute: async (input: { city: string }) => ({ temp: 20, city: input.city }),
  };
}

const weatherCall: ChatMessage = {
  role: 'assistant',
  content: '',
  toolCalls: [
    {
      id: 'call_1',
      type: 'function',
      function: { name: 'get_weather', arguments: '{"city":"beijing"}' },
    },
  ],
};

describe('AgentLoop', () => {
  it('单轮直接回答', async () => {
    const provider = makeProvider([{ message: { role: 'assistant', content: 'Hello!' } }]);
    const loop = new AgentLoop({
      provider,
      registry: new ToolRegistry(),
      systemPrompt: 'you are helpful',
    });

    const result = await loop.run('hi');

    expect(result.finalMessage.content).toBe('Hello!');
    expect(result.steps).toBe(1);
    expect(result.messages[0]).toMatchObject({ role: 'system' });
    expect(result.messages[1]).toMatchObject({ role: 'user', content: 'hi' });
  });

  it('多轮工具循环并回填结果', async () => {
    const registry = new ToolRegistry();
    registry.register(makeWeatherTool());

    const provider = makeProvider([
      { message: weatherCall },
      { message: { role: 'assistant', content: 'Beijing is 20 degrees' } },
    ]);
    const loop = new AgentLoop({ provider, registry, systemPrompt: 'you are helpful' });

    const result = await loop.run('weather in beijing?');

    expect(result.steps).toBe(2);
    expect(result.finalMessage.content).toBe('Beijing is 20 degrees');

    const toolMsg = result.messages.find((m) => m.role === 'tool');
    expect(toolMsg?.content).toContain('20');
    expect(toolMsg?.toolCallId).toBe('call_1');
  });

  it('maxSteps 兜底终止', async () => {
    const registry = new ToolRegistry();
    registry.register(makeWeatherTool());

    // provider 一直返回 toolCalls，永不自然终止
    const provider = makeProvider([{ message: weatherCall }]);
    const loop = new AgentLoop({ provider, registry, systemPrompt: 's', maxSteps: 3 });

    const result = await loop.run('x');

    expect(result.steps).toBe(3);
  });

  it('工具执行错误回填而非终止', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'failing',
      description: 'always fails',
      inputSchema: z.object({}),
      execute: async () => {
        throw new Error('boom');
      },
    });

    const failingCall: ChatMessage = {
      role: 'assistant',
      content: '',
      toolCalls: [
        { id: 'call_x', type: 'function', function: { name: 'failing', arguments: '{}' } },
      ],
    };

    const provider = makeProvider([
      { message: failingCall },
      { message: { role: 'assistant', content: 'tool failed, fallback answer' } },
    ]);
    const loop = new AgentLoop({ provider, registry, systemPrompt: 's' });

    const result = await loop.run('x');

    const toolMsg = result.messages.find((m) => m.role === 'tool');
    expect(toolMsg?.content).toContain('Error: boom');
    expect(result.finalMessage.content).toBe('tool failed, fallback answer');
  });

  it('systemPrompt 支持函数式动态生成', async () => {
    const provider = makeProvider([{ message: { role: 'assistant', content: 'Hello!' } }]);
    const systemPrompt = rs.fn((userInput: string) => `你是 ${userInput} 专家`);
    const loop = new AgentLoop({
      provider,
      registry: new ToolRegistry(),
      systemPrompt,
    });

    const result = await loop.run('Vue');

    expect(systemPrompt).toHaveBeenCalledWith('Vue');
    expect(result.messages[0]).toMatchObject({ role: 'system', content: '你是 Vue 专家' });
  });

  it('systemPrompt 支持异步函数', async () => {
    const provider = makeProvider([{ message: { role: 'assistant', content: 'Hi' } }]);
    const loop = new AgentLoop({
      provider,
      registry: new ToolRegistry(),
      systemPrompt: async (input: string) => `prompt:${input}`,
    });

    const result = await loop.run('x');

    expect(result.messages[0]).toMatchObject({ role: 'system', content: 'prompt:x' });
  });

  it('hooks 调用点按序触发', async () => {
    const registry = new ToolRegistry();
    registry.register(makeWeatherTool());

    const provider = makeProvider([
      { message: weatherCall },
      { message: { role: 'assistant', content: 'done' } },
    ]);

    const beforeLLM = rs.fn();
    const afterLLM = rs.fn();
    const beforeToolCall = rs.fn();
    const afterToolCall = rs.fn();

    const hooks = new HookPipeline();
    hooks.register({ name: 'test', beforeLLM, afterLLM, beforeToolCall, afterToolCall });

    const loop = new AgentLoop({ provider, registry, systemPrompt: 's', hooks });
    await loop.run('x');

    expect(beforeLLM).toHaveBeenCalledTimes(2);
    expect(afterLLM).toHaveBeenCalledTimes(2);
    expect(beforeToolCall).toHaveBeenCalledWith('get_weather', '{"city":"beijing"}');
    expect(afterToolCall).toHaveBeenCalledWith('get_weather', expect.stringContaining('20'));
  });

  it('注入 memory 后跨 run 累积历史', async () => {
    const memory = new ConversationMemory();
    const seen: ChatMessage[][] = [];
    const provider: LLMProvider = {
      name: 'mock',
      async chatCompletion(params) {
        seen.push(params.messages);
        return { message: { role: 'assistant', content: 'answer' } };
      },
    };
    const loop = new AgentLoop({
      provider,
      registry: new ToolRegistry(),
      systemPrompt: 's',
      memory,
    });

    await loop.run('第一问');
    await loop.run('第二问');

    // 第二轮调用应携带第一轮的历史
    const second = seen[1];
    expect(second?.some((m) => m.role === 'user' && m.content === '第一问')).toBe(true);
    expect(second?.some((m) => m.role === 'assistant' && m.content === 'answer')).toBe(true);
    expect(memory.size).toBe(4); // 第一轮 user+assistant，第二轮 user+assistant
  });

  it('异常时不回写 memory', async () => {
    const memory = new ConversationMemory();
    const provider: LLMProvider = {
      name: 'mock',
      async chatCompletion() {
        throw new Error('boom');
      },
    };
    const loop = new AgentLoop({
      provider,
      registry: new ToolRegistry(),
      systemPrompt: 's',
      memory,
    });

    await expect(loop.run('x')).rejects.toThrow('boom');
    expect(memory.size).toBe(0);
  });

  it('systemPrompt 模板对象 + rules 自动检索注入', async () => {
    const captured: ChatMessage[][] = [];
    const provider: LLMProvider = {
      name: 'mock',
      async chatCompletion(params) {
        captured.push(params.messages);
        return { message: { role: 'assistant', content: 'ok' } };
      },
    };
    const loop = new AgentLoop({
      provider,
      registry: new ToolRegistry(),
      systemPrompt: { template: '你是 {{role}}。\n{{rules}}', variables: { role: '专家' } },
      rules: [
        { id: 'r1', kind: 'always', description: '简洁', content: '回答要简洁', tags: [] },
        {
          id: 'r2',
          kind: 'on-demand',
          description: 'Vue3 编码规范',
          content: '使用 script setup',
          tags: ['vue'],
        },
      ],
    });

    await loop.run('帮我写 Vue 组件');

    const systemMsg = captured[0]?.find((m) => m.role === 'system');
    expect(systemMsg?.content).toContain('专家');
    expect(systemMsg?.content).toContain('回答要简洁');
    expect(systemMsg?.content).toContain('使用 script setup');
  });

  it('string systemPrompt 兜底追加 rules 文本', async () => {
    const captured: ChatMessage[][] = [];
    const provider: LLMProvider = {
      name: 'mock',
      async chatCompletion(params) {
        captured.push(params.messages);
        return { message: { role: 'assistant', content: 'ok' } };
      },
    };
    const loop = new AgentLoop({
      provider,
      registry: new ToolRegistry(),
      systemPrompt: 'you are helpful',
      rules: [{ id: 'r1', kind: 'always', description: '简洁', content: '回答要简洁', tags: [] }],
    });

    await loop.run('hi');

    const systemMsg = captured[0]?.find((m) => m.role === 'system');
    expect(systemMsg?.content).toContain('you are helpful');
    expect(systemMsg?.content).toContain('回答要简洁');
  });

  it('函数式 systemPrompt 兜底追加 rules 文本', async () => {
    const captured: ChatMessage[][] = [];
    const provider: LLMProvider = {
      name: 'mock',
      async chatCompletion(params) {
        captured.push(params.messages);
        return { message: { role: 'assistant', content: 'ok' } };
      },
    };
    const loop = new AgentLoop({
      provider,
      registry: new ToolRegistry(),
      systemPrompt: async (input: string) => `你是 ${input} 专家`,
      rules: [{ id: 'r1', kind: 'always', description: '简洁', content: '回答要简洁', tags: [] }],
    });

    await loop.run('Vue');

    const systemMsg = captured[0]?.find((m) => m.role === 'system');
    expect(systemMsg?.content).toContain('你是 Vue 专家');
    expect(systemMsg?.content).toContain('回答要简洁');
  });
});
