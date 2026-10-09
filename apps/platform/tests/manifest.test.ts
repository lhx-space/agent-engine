import { describe, expect, it } from '@rstest/core';
import { mergeManifest, parseManifest, serializeManifest } from '../src/lib/manifest';

const baseConfig = {
  name: 'demo-agent',
  model: {
    provider: 'openai-compatible',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  systemPrompt: { template: 'you are helpful', variables: {} },
  embedding: { model: 'bge-m3', dimension: 1024 },
};

describe('parseManifest', () => {
  it('合法 manifest 解析为 AgentConfig', () => {
    const result = parseManifest(baseConfig);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config.name).toBe('demo-agent');
  });

  it('非法 manifest 返回字段级 issues 而不抛错', () => {
    const result = parseManifest({ name: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
  });

  it('缺 embedding.dimension 时校验失败', () => {
    const result = parseManifest({ ...baseConfig, embedding: { model: 'bge-m3' } });
    expect(result.ok).toBe(false);
  });
});

describe('serializeManifest', () => {
  it('序列化后可被重新解析（往返一致）', () => {
    const parsed = parseManifest(baseConfig);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const json = serializeManifest(parsed.config);
    const again = parseManifest(json);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.config.name).toBe('demo-agent');
  });
});

describe('mergeManifest', () => {
  it('顶层标量覆写', () => {
    const merged = mergeManifest({ name: 'a', model: { model: 'x' } }, { name: 'b' });
    expect(merged.name).toBe('b');
  });

  it('对象字段做一层深合并，不整体替换', () => {
    const merged = mergeManifest(
      { model: { model: 'x', temperature: 0.2 } },
      { model: { model: 'y' } },
    );
    expect(merged.model).toEqual({ model: 'y', temperature: 0.2 });
  });

  it('不修改原 manifest（版本不可变）', () => {
    const manifest = { model: { model: 'x' } };
    mergeManifest(manifest, { model: { model: 'y' } });
    expect(manifest.model).toEqual({ model: 'x' });
  });
});
