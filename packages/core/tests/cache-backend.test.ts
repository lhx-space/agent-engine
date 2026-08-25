import { describe, expect, it } from '@rstest/core';
import { AgentConfigSchema } from '@agent-engine/config';
import { InMemoryCacheBackend } from '../src/cache/cache-backend';
import type { CacheBackend } from '../src/cache/cache-backend';
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

describe('InMemoryCacheBackend', () => {
  it('set/get/delete/clear', async () => {
    const backend = new InMemoryCacheBackend();
    await backend.set('a', 1);
    expect(await backend.get('a')).toBe(1);
    expect(await backend.delete('a')).toBe(true);
    expect(await backend.get('a')).toBeUndefined();
    await backend.set('b', 2);
    await backend.clear();
    expect(await backend.get('b')).toBeUndefined();
  });

  it('TTL 过期后 get 返回 undefined', async () => {
    const backend = new InMemoryCacheBackend();
    await backend.set('k', 'v', 10);
    expect(await backend.get('k')).toBe('v');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await backend.get('k')).toBeUndefined();
  });

  it('无 TTL 不过期', async () => {
    const backend = new InMemoryCacheBackend();
    await backend.set('k', 'v');
    expect(await backend.get('k')).toBe('v');
  });
});

describe('resolveAgentConfig 缓存后端解析', () => {
  it('缺省 in-memory', async () => {
    const config = AgentConfigSchema.parse({
      name: 't',
      model: { provider: 'custom', baseURL: 'http://localhost', model: 'mock' },
      systemPrompt: { template: 'hi' },
    });
    const resolved = await resolveAgentConfig(config, { providerFactory: () => makeProvider() });
    expect(resolved.cacheBackend.name).toBe('in-memory');
    await resolved.dispose();
  });

  it('插件注册自定义缓存后端并按名选中', async () => {
    const customCache: CacheBackend = {
      name: 'redis',
      get: async () => undefined,
      set: async () => {},
      delete: async () => false,
      clear: async () => {},
    };
    const config = AgentConfigSchema.parse({
      name: 't',
      model: { provider: 'custom', baseURL: 'http://localhost', model: 'mock' },
      systemPrompt: { template: 'hi' },
      cache: { backend: 'redis' },
      plugins: ['cache-plugin'],
    });
    const resolved = await resolveAgentConfig(config, {
      providerFactory: () => makeProvider(),
      pluginFactories: {
        'cache-plugin': () => ({
          name: 'cache-plugin',
          description: '测试缓存插件',
          version: '1.0.0',
          install(ctx) {
            ctx.registerCacheBackend(customCache);
          },
        }),
      },
    });
    expect(resolved.cacheBackend.name).toBe('redis');
    await resolved.dispose();
  });

  it('未注册名报错', async () => {
    const config = AgentConfigSchema.parse({
      name: 't',
      model: { provider: 'custom', baseURL: 'http://localhost', model: 'mock' },
      systemPrompt: { template: 'hi' },
      cache: { backend: 'nope' },
    });
    await expect(
      resolveAgentConfig(config, { providerFactory: () => makeProvider() }),
    ).rejects.toThrow(/cache\.backend/);
  });
});
