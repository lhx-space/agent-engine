import { describe, expect, it } from '@rstest/core';
import { AgentLoop } from '../src/agent/loop';
import type { ChatCompletionResult, ChatMessage, LLMProvider } from '../src/llm/types';
import type { LongTermMemory } from '../src/memory/long-term-memory';
import { ToolRegistry } from '../src/tools/registry';

describe('AgentLoop 长期记忆（协议：LongTermMemory）', () => {
  function makeProvider(captured: ChatMessage[][]): LLMProvider {
    let i = 0;
    return {
      name: 'mock',
      async chatCompletion(params) {
        captured.push(params.messages);
        i += 1;
        const r: ChatCompletionResult = {
          message: { role: 'assistant', content: `answer-${i}` },
        };
        return r;
      },
    };
  }

  it('recall 注入 system prompt + 正常结束 remember 写回', async () => {
    const captured: ChatMessage[][] = [];
    const provider = makeProvider(captured);

    let remembered = '';
    const ltm: LongTermMemory = {
      name: 'mock',
      async remember(text: string) {
        remembered = text;
      },
      async recall() {
        return ['背景：用户偏好蓝色'];
      },
    };

    const loop = new AgentLoop({
      provider,
      registry: new ToolRegistry(),
      systemPrompt: 'base',
      longTermMemory: ltm,
    });
    await loop.run('我喜欢什么颜色');

    const system = captured[0]?.find((m) => m.role === 'system');
    expect(system?.content).toContain('[长期记忆]');
    expect(system?.content).toContain('背景：用户偏好蓝色');
    expect(remembered).toContain('我喜欢什么颜色');
    expect(remembered).toContain('answer-1');
  });

  it('异常不写回长期记忆', async () => {
    let remembered = false;
    const ltm: LongTermMemory = {
      name: 'mock',
      async remember() {
        remembered = true;
      },
      async recall() {
        return [];
      },
    };
    const provider: LLMProvider = {
      name: 'mock',
      async chatCompletion() {
        throw new Error('boom');
      },
    };

    const loop = new AgentLoop({
      provider,
      registry: new ToolRegistry(),
      systemPrompt: 'base',
      longTermMemory: ltm,
    });

    await expect(loop.run('hi')).rejects.toThrow('boom');
    expect(remembered).toBe(false);
  });
});
