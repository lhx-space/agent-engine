import { describe, expect, it } from '@rstest/core';
import { AgentConfigSchema } from '@agent-engine/config';
import { InMemoryMemoryBackend } from '@agent-engine/core';
import { InMemoryVectorStore } from '@agent-engine/core';
import {
  createPresetLongTermMemoryFactory,
  createPresetPluginFactories,
  defaultCapabilityPlugins,
} from '../src/index';

function baseConfig() {
  return AgentConfigSchema.parse({
    name: 't',
    model: { provider: 'custom', baseURL: 'http://localhost', model: 'mock' },
    systemPrompt: { template: 'hi' },
  });
}

describe('createPresetPluginFactories', () => {
  it('返回全部能力插件工厂', () => {
    const factories = createPresetPluginFactories(baseConfig());
    expect(Object.keys(factories).sort()).toEqual([
      '@agent-engine/plugin-bash',
      '@agent-engine/plugin-documents',
      '@agent-engine/plugin-files',
      '@agent-engine/plugin-git',
      '@agent-engine/plugin-guardrails',
      '@agent-engine/plugin-mcp',
      '@agent-engine/plugin-otel',
      '@agent-engine/plugin-rules',
      '@agent-engine/plugin-skills',
      '@agent-engine/plugin-web',
    ]);
  });
});

describe('defaultCapabilityPlugins', () => {
  it('web 恒激活 + 能力按 config 切片激活', () => {
    const names = defaultCapabilityPlugins(baseConfig());
    expect(names).toContain('@agent-engine/plugin-web');
    expect(names).not.toContain('@agent-engine/plugin-rules');
  });

  it('rules/skills/documents/guardrails/mcp 非空时激活', () => {
    const config = baseConfig();
    config.rules = [{ id: 'r1', kind: 'always', description: 'x', content: 'y', tags: [] }];
    config.skills = [{ source: 'path', path: './s' }];
    config.documents = {
      sources: ['./docs'],
      chunking: { strategy: 'fixed', size: 1000, overlap: 0 },
      topK: 4,
    };
    config.guardrails = [{ id: 'g1', denyTools: ['builtin.bash'] }];
    config.mcp = { servers: [{ source: 'command', name: 'm', command: 'node', args: [] }] };

    const names = defaultCapabilityPlugins(config);
    expect(names).toContain('@agent-engine/plugin-rules');
    expect(names).toContain('@agent-engine/plugin-skills');
    expect(names).toContain('@agent-engine/plugin-documents');
    expect(names).toContain('@agent-engine/plugin-guardrails');
    expect(names).toContain('@agent-engine/plugin-mcp');
  });
});

describe('createPresetLongTermMemoryFactory', () => {
  it('创建 SemanticMemory（LongTermMemory 协议）', () => {
    const factory = createPresetLongTermMemoryFactory();
    const memory = factory({
      vectorStore: new InMemoryVectorStore(),
      embedding: undefined,
      memoryBackend: new InMemoryMemoryBackend(),
    });
    expect(memory.name).toBe('semantic');
  });
});
