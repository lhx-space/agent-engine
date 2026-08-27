import { describe, expect, it } from '@rstest/core';
import { ContextComposer } from '../src/context/context-composer';
import { HookPipeline } from '../src/hooks/pipeline';
import { ConversationMemory } from '../src/memory/conversation-memory';
import type { LongTermMemory } from '../src/memory/long-term-memory';

describe('ContextComposer', () => {
  it('组装 messages：system + 历史 + user，注入长期记忆', async () => {
    const memory = new ConversationMemory();
    memory.append([
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1' },
    ]);
    const ltm: LongTermMemory = {
      name: 'mock',
      remember: async () => {},
      recall: async () => ['偏好蓝色'],
    };
    const composer = new ContextComposer({
      systemPrompt: 'base',
      memory,
      longTermMemory: ltm,
    });

    const result = await composer.compose('hi');

    expect(result.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    const system = result.messages[0]?.content ?? '';
    expect(system).toContain('base');
    expect(system).toContain('[长期记忆]');
    expect(system).toContain('偏好蓝色');
  });

  it('注入 injectedFragment', async () => {
    const composer = new ContextComposer({
      systemPrompt: 'base',
    });

    const result = await composer.compose('query', '外部素材');

    const system = result.messages[0]?.content ?? '';
    expect(system).toContain('外部素材');
  });
});

describe('beforeContextCompose', () => {
  it('收集各 hook 注入片段', async () => {
    const pipeline = new HookPipeline();
    pipeline.register({ name: 'h1', beforeContextCompose: async () => '片段A' });
    pipeline.register({ name: 'h2', beforeContextCompose: async () => '片段B' });

    const fragment = await pipeline.beforeContextCompose('hi');

    expect(fragment).toBe('片段A\n\n片段B');
  });
});
