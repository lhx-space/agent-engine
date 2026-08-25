import { describe, expect, it } from '@rstest/core';
import { AgentLoop } from '../src/agent/loop';
import type { EmbeddingProvider } from '../src/embedding/embedding';
import type { ChatCompletionResult, ChatMessage, LLMProvider } from '../src/llm/types';
import { InMemoryMemoryBackend } from '../src/memory/memory-backend';
import { SemanticMemory } from '../src/memory/long-term-memory';
import type { LongTermMemory } from '../src/memory/long-term-memory';
import { InMemoryVectorStore } from '../src/retrieval/vector-store';
import { ToolRegistry } from '../src/tools/registry';

function makeEmbedding(): EmbeddingProvider {
  return {
    name: 'mock',
    dimension: 2,
    async embed(texts: string[]) {
      return texts.map(() => [1, 0]);
    },
  };
}

describe('SemanticMemory', () => {
  it('remember 向量化写入 + recall 召回', async () => {
    const backend = new InMemoryMemoryBackend();
    const store = new InMemoryVectorStore();
    const mem = new SemanticMemory(store, makeEmbedding(), backend);

    await mem.remember('用户偏好蓝色');
    const recalled = await mem.recall('喜欢什么颜色', 3);

    expect(recalled).toContain('用户偏好蓝色');
    // 同时持久化到 MemoryBackend。
    expect(await backend.keys()).toHaveLength(1);
  });

  it('无 embedding 时 no-op', async () => {
    const backend = new InMemoryMemoryBackend();
    const store = new InMemoryVectorStore();
    const mem = new SemanticMemory(store, undefined, backend);

    await mem.remember('不会写入');
    expect(await mem.recall('任意')).toEqual([]);
    expect(await backend.keys()).toHaveLength(0);
  });
});

describe('AgentLoop 长期记忆', () => {
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
