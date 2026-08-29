import { describe, expect, it } from '@rstest/core';
import { createParallelSearchProvider, dedupeResults, rankResults } from '../src/search';
import type { SearchProvider, SearchResult } from '../src/search';

function provider(name: string, results: SearchResult[]): SearchProvider {
  return {
    name,
    async search() {
      return results;
    },
  };
}

describe('dedupeResults', () => {
  it('按 URL 去重，保留首次出现', () => {
    const results = [
      { title: 'a', url: 'https://x.com/1', snippet: '' },
      { title: 'b', url: 'https://x.com/2', snippet: '' },
      { title: 'a-dup', url: 'https://x.com/1', snippet: '' },
    ];
    expect(dedupeResults(results)).toHaveLength(2);
  });
});

describe('rankResults', () => {
  it('关键词命中多的排前面', () => {
    const results = [
      { title: '无关', url: 'https://x.com/1', snippet: 'no match' },
      { title: 'deepseek 模型', url: 'https://x.com/2', snippet: 'deepseek 大模型' },
    ];
    const ranked = rankResults(results, 'deepseek 模型');
    expect(ranked[0]?.url).toBe('https://x.com/2');
  });
});

describe('createParallelSearchProvider', () => {
  it('并行合并 + 去重 + 重排', async () => {
    const p = createParallelSearchProvider([
      provider('a', [{ title: 'deepseek 模型', url: 'https://x.com/1', snippet: 'deepseek' }]),
      provider('b', [
        { title: 'dup', url: 'https://x.com/1', snippet: 'dup' },
        { title: 'deepseek 部署', url: 'https://x.com/2', snippet: 'deepseek 部署指南' },
      ]),
    ]);
    const results = await p.search('deepseek 部署');
    // 去重后 2 条；「deepseek 部署」命中 2 词排第一
    expect(results).toHaveLength(2);
    expect(results[0]?.url).toBe('https://x.com/2');
  });

  it('全部失败 → 抛最后一个错误', async () => {
    const failing: SearchProvider = {
      name: 'f',
      async search() {
        throw new Error('boom');
      },
    };
    const p = createParallelSearchProvider([failing]);
    await expect(p.search('q')).rejects.toThrow('boom');
  });
});
