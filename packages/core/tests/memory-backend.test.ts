import { describe, expect, it } from '@rstest/core';
import { AgentConfigSchema } from '@lhx-agent-engine/config';
import { InMemoryMemoryBackend } from '../src/memory/memory-backend';
import type { MemoryBackend } from '../src/memory/memory-backend';
import type { LLMProvider } from '../src/llm/types';
import { resolveAgentConfig } from '../src/resolve/resolve';

function makeProvider(): LLMProvider {
  return {
    name: 'mock',
    async chatCompletion() {
      return { message: { role: 'assistant', content: 'ok' } };
    },
  };
}

describe('InMemoryMemoryBackend', () => {
  it('set/get/delete/keys/clear', async () => {
    const backend = new InMemoryMemoryBackend();
    await backend.set('a', 1);
    await backend.set('b', 2);
    expect(await backend.get('a')).toBe(1);
    expect(await backend.keys()).toEqual(['a', 'b']);
    expect(await backend.delete('a')).toBe(true);
    expect(await backend.get('a')).toBeUndefined();
    await backend.clear();
    expect(await backend.keys()).toEqual([]);
  });

  it('keys 前缀过滤', async () => {
    const backend = new InMemoryMemoryBackend();
    await backend.set('session:1', 'x');
    await backend.set('session:2', 'y');
    await backend.set('other', 'z');
    expect(await backend.keys('session:')).toEqual(['session:1', 'session:2']);
  });
});

describe('resolveAgentConfig 长期记忆后端解析', () => {
  it('缺省 in-memory', async () => {
    const config = AgentConfigSchema.parse({
      name: 't',
      model: { provider: 'custom', baseURL: 'http://localhost', model: 'mock' },
      systemPrompt: { template: 'hi' },
    });
    const resolved = await resolveAgentConfig(config, { providerFactory: () => makeProvider() });
    expect(resolved.memoryBackend.name).toBe('in-memory');
    await resolved.dispose();
  });

  it('插件注册自定义后端并按名选中', async () => {
    const customMemory: MemoryBackend = {
      name: 'pgvector',
      get: async () => undefined,
      set: async () => {},
      delete: async () => false,
      keys: async () => [],
      clear: async () => {},
    };
    const config = AgentConfigSchema.parse({
      name: 't',
      model: { provider: 'custom', baseURL: 'http://localhost', model: 'mock' },
      systemPrompt: { template: 'hi' },
      memory: { longTerm: { backend: 'pgvector' } },
      plugins: ['storage-plugin'],
    });
    const resolved = await resolveAgentConfig(config, {
      providerFactory: () => makeProvider(),
      pluginFactories: {
        'storage-plugin': () => ({
          name: 'storage-plugin',
          description: '测试存储插件',
          version: '1.0.0',
          install(ctx) {
            ctx.registerMemoryBackend(customMemory);
          },
        }),
      },
    });
    expect(resolved.memoryBackend.name).toBe('pgvector');
    await resolved.dispose();
  });

  it('未注册名报错', async () => {
    const config = AgentConfigSchema.parse({
      name: 't',
      model: { provider: 'custom', baseURL: 'http://localhost', model: 'mock' },
      systemPrompt: { template: 'hi' },
      memory: { longTerm: { backend: 'nope' } },
    });
    await expect(
      resolveAgentConfig(config, { providerFactory: () => makeProvider() }),
    ).rejects.toThrow(/memory\.longTerm\.backend/);
  });
});
