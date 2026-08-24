import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';
import { AgentLoop } from '../src/agent/loop';
import { ConversationMemory } from '../src/memory/conversation-memory';
import {
  AbortError,
  type ChatCompletionResult,
  type ChatMessage,
  type LLMProvider,
} from '../src/llm/types';
import { ToolRegistry } from '../src/tools/registry';

/** 按顺序返回响应，最后一个响应无限重复（便于测试预算兜底）。 */
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeToolCall(id: string, name: string, args = '{}'): ChatMessage {
  return {
    role: 'assistant',
    content: '',
    toolCalls: [{ id, type: 'function', function: { name, arguments: args } }],
  };
}

describe('AgentLoop 强化', () => {
  it('多个 tool_calls 并发执行并顺序回填', async () => {
    const registry = new ToolRegistry();
    let active = 0;
    let maxActive = 0;
    const makeDelayedTool = (name: string) => ({
      name,
      description: `tool ${name}`,
      inputSchema: z.object({}),
      execute: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await sleep(30);
        active -= 1;
        return name;
      },
    });
    registry.register(makeDelayedTool('t1'));
    registry.register(makeDelayedTool('t2'));

    const call: ChatMessage = {
      role: 'assistant',
      content: '',
      toolCalls: [
        { id: 'c1', type: 'function', function: { name: 't1', arguments: '{}' } },
        { id: 'c2', type: 'function', function: { name: 't2', arguments: '{}' } },
      ],
    };
    const provider = makeProvider([
      { message: call },
      { message: { role: 'assistant', content: 'done' } },
    ]);
    const loop = new AgentLoop({ provider, registry, systemPrompt: 's' });

    const result = await loop.run('x');

    expect(maxActive).toBeGreaterThanOrEqual(2);
    const toolMsgs = result.messages.filter((m) => m.role === 'tool');
    expect(toolMsgs.length).toBe(2);
    expect(toolMsgs[0]?.content).toContain('t1');
    expect(toolMsgs[1]?.content).toContain('t2');
  });

  it('并发执行中单个工具失败不阻塞其他', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'ok',
      description: 'ok',
      inputSchema: z.object({}),
      execute: async () => 'ok-result',
    });
    registry.register({
      name: 'fail',
      description: 'fail',
      inputSchema: z.object({}),
      execute: async () => {
        throw new Error('boom');
      },
    });

    const call: ChatMessage = {
      role: 'assistant',
      content: '',
      toolCalls: [
        { id: 'c1', type: 'function', function: { name: 'ok', arguments: '{}' } },
        { id: 'c2', type: 'function', function: { name: 'fail', arguments: '{}' } },
      ],
    };
    const provider = makeProvider([
      { message: call },
      { message: { role: 'assistant', content: 'done' } },
    ]);
    const loop = new AgentLoop({ provider, registry, systemPrompt: 's' });

    const result = await loop.run('x');

    const toolMsgs = result.messages.filter((m) => m.role === 'tool');
    expect(toolMsgs[0]?.content).toContain('ok-result');
    expect(toolMsgs[1]?.content).toContain('Error: boom');
  });

  it('工具执行失败按配置重试（指数退避）', async () => {
    const registry = new ToolRegistry();
    let attempts = 0;
    registry.register({
      name: 'flaky',
      description: 'flaky',
      inputSchema: z.object({}),
      execute: async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('transient');
        return 'ok';
      },
    });

    const provider = makeProvider([
      { message: makeToolCall('c1', 'flaky') },
      { message: { role: 'assistant', content: 'done' } },
    ]);
    const loop = new AgentLoop({
      provider,
      registry,
      systemPrompt: 's',
      execution: { toolRetry: { maxRetries: 2, baseDelayMs: 1 } },
    });

    const result = await loop.run('x');

    expect(attempts).toBe(3);
    expect(result.messages.find((m) => m.role === 'tool')?.content).toContain('ok');
  });

  it('默认不重试', async () => {
    const registry = new ToolRegistry();
    let attempts = 0;
    registry.register({
      name: 'f',
      description: 'f',
      inputSchema: z.object({}),
      execute: async () => {
        attempts += 1;
        throw new Error('boom');
      },
    });

    const provider = makeProvider([
      { message: makeToolCall('c1', 'f') },
      { message: { role: 'assistant', content: 'done' } },
    ]);
    const loop = new AgentLoop({ provider, registry, systemPrompt: 's' });

    await loop.run('x');

    expect(attempts).toBe(1);
  });

  it('入口已中止则抛 AbortError', async () => {
    const provider = makeProvider([{ message: { role: 'assistant', content: 'x' } }]);
    const loop = new AgentLoop({ provider, registry: new ToolRegistry(), systemPrompt: 's' });

    const controller = new AbortController();
    controller.abort();

    await expect(loop.run('x', { signal: controller.signal })).rejects.toBeInstanceOf(AbortError);
  });

  it('run 过程中中止不回写 memory', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 't',
      description: 't',
      inputSchema: z.object({}),
      execute: async () => 'ok',
    });
    const memory = new ConversationMemory();
    const controller = new AbortController();
    let calls = 0;
    const provider: LLMProvider = {
      name: 'mock',
      async chatCompletion() {
        calls += 1;
        if (calls === 1) {
          controller.abort();
          return { message: makeToolCall('c1', 't') };
        }
        return { message: { role: 'assistant', content: 'done' } };
      },
    };
    const loop = new AgentLoop({ provider, registry, systemPrompt: 's', memory });

    await expect(loop.run('x', { signal: controller.signal })).rejects.toBeInstanceOf(AbortError);
    expect(memory.size).toBe(0);
  });

  it('finishReason=length 自动续写', async () => {
    const provider = makeProvider([
      { message: { role: 'assistant', content: 'part1' }, finishReason: 'length' },
      { message: { role: 'assistant', content: 'part1 part2' }, finishReason: 'stop' },
    ]);
    const loop = new AgentLoop({ provider, registry: new ToolRegistry(), systemPrompt: 's' });

    const result = await loop.run('x');

    expect(result.steps).toBe(2);
    expect(result.finalMessage.content).toBe('part1 part2');
    expect(result.finishReason).toBe('stop');
    expect(result.messages.some((m) => m.role === 'user' && m.content.includes('截断'))).toBe(true);
  });

  it('maxContinuations=0 不续写', async () => {
    const provider = makeProvider([
      { message: { role: 'assistant', content: 'part1' }, finishReason: 'length' },
    ]);
    const loop = new AgentLoop({
      provider,
      registry: new ToolRegistry(),
      systemPrompt: 's',
      execution: { maxContinuations: 0 },
    });

    const result = await loop.run('x');

    expect(result.steps).toBe(1);
    expect(result.finalMessage.content).toBe('part1');
    expect(result.finishReason).toBe('length');
  });

  it('execution.maxSteps 配置生效', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 't',
      description: 't',
      inputSchema: z.object({}),
      execute: async () => 'ok',
    });
    // 带 tools 返回 toolCalls；不带 tools（总结）返回纯文本。
    const provider: LLMProvider = {
      name: 'mock',
      async chatCompletion(params) {
        if (params.tools && params.tools.length > 0) {
          return { message: makeToolCall('c1', 't') };
        }
        return { message: { role: 'assistant', content: 'done' } };
      },
    };
    const loop = new AgentLoop({
      provider,
      registry,
      systemPrompt: 's',
      execution: { maxSteps: 3 },
    });

    const result = await loop.run('x');

    expect(result.steps).toBe(4); // 3 步 toolCalls + 1 步总结
    expect(result.finalMessage.content).toBe('done');
  });

  it('execution.maxToolCalls 超限回填占位且不再执行工具', async () => {
    const registry = new ToolRegistry();
    let executed = 0;
    registry.register({
      name: 't',
      description: 't',
      inputSchema: z.object({}),
      execute: async () => {
        executed += 1;
        return 'ok';
      },
    });
    const call: ChatMessage = {
      role: 'assistant',
      content: '',
      toolCalls: [
        { id: 'c1', type: 'function', function: { name: 't', arguments: '{}' } },
        { id: 'c2', type: 'function', function: { name: 't', arguments: '{}' } },
      ],
    };
    const provider = makeProvider([{ message: call }]); // 永远返回两个 tool_calls
    const loop = new AgentLoop({
      provider,
      registry,
      systemPrompt: 's',
      execution: { maxToolCalls: 2, maxSteps: 5 },
    });

    const result = await loop.run('x');

    expect(executed).toBe(2);
    const placeholders = result.messages.filter(
      (m) => m.role === 'tool' && m.content.includes('已达上限'),
    );
    expect(placeholders.length).toBeGreaterThan(0);
  });

  it('maxSteps 兜底时若仍带 toolCalls 则强制总结', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 't',
      description: 't',
      inputSchema: z.object({}),
      execute: async () => 'ok',
    });

    // 带 tools 的调用返回 toolCalls；不带 tools（总结）返回纯文本。
    const provider: LLMProvider = {
      name: 'mock',
      async chatCompletion(params) {
        if (params.tools && params.tools.length > 0) {
          return { message: makeToolCall('c1', 't') };
        }
        return { message: { role: 'assistant', content: '最终总结' } };
      },
    };
    const loop = new AgentLoop({
      provider,
      registry,
      systemPrompt: 's',
      execution: { maxSteps: 2 },
    });

    const result = await loop.run('x');

    expect(result.finalMessage.toolCalls).toBeUndefined();
    expect(result.finalMessage.content).toBe('最终总结');
    expect(result.steps).toBe(3); // 2 步正常 + 1 步总结
  });
});
