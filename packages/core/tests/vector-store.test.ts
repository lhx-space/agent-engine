import { describe, expect, it } from '@rstest/core';
import { InMemoryVectorStore } from '../src/retrieval/vector-store';

/** 构造一个可区分的记录集合：两个 namespace × 两个 kind。 */
async function seeded(): Promise<InMemoryVectorStore> {
  const store = new InMemoryVectorStore();
  await store.add([
    { id: 'a', vector: [1, 0], namespace: 'agent-a', kind: 'memory', content: 'A 的记忆' },
    { id: 'b', vector: [0, 1], namespace: 'agent-b', kind: 'memory', content: 'B 的记忆' },
    { id: 'c', vector: [1, 0], namespace: 'agent-a', kind: 'document', content: 'A 的文档' },
  ]);
  return store;
}

describe('InMemoryVectorStore', () => {
  it('不传 filter 时全量检索（向后兼容）', async () => {
    const store = await seeded();
    const hits = await store.query([1, 0], 10);
    expect(hits.map((hit) => hit.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('按 namespace 隔离', async () => {
    const store = await seeded();
    const hits = await store.query([1, 0], 10, { namespace: 'agent-a' });
    expect(hits.map((hit) => hit.id).sort()).toEqual(['a', 'c']);
  });

  it('按 kind 隔离', async () => {
    const store = await seeded();
    const hits = await store.query([1, 0], 10, { kind: 'document' });
    expect(hits.map((hit) => hit.id)).toEqual(['c']);
  });

  it('同时按 namespace 与 kind 过滤', async () => {
    const store = await seeded();
    const hits = await store.query([1, 0], 10, { namespace: 'agent-b', kind: 'memory' });
    expect(hits.map((hit) => hit.id)).toEqual(['b']);
  });

  it('命中项带回原文 content', async () => {
    const store = await seeded();
    const hits = await store.query([1, 0], 1, { namespace: 'agent-a', kind: 'memory' });
    expect(hits[0]?.content).toBe('A 的记忆');
  });

  it('topK 生效且按分数降序', async () => {
    const store = await seeded();
    const hits = await store.query([1, 0], 1, { namespace: 'agent-a' });
    expect(hits.length).toBe(1);
    expect(hits[0]?.score).toBeGreaterThan(0.9);
  });
});
