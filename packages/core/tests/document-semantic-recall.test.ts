import { describe, expect, it } from '@rstest/core';
import { reciprocalRankFusion } from '../src/retrieval/rrf';

describe('reciprocalRankFusion', () => {
  it('同 id 多路去重合并、按排名加权', () => {
    const fused = reciprocalRankFusion([[{ id: 'a', score: 9 }], [{ id: 'a', score: 8 }]]);
    expect(fused).toHaveLength(1);
    expect(fused[0]?.id).toBe('a');
    expect(fused[0]?.score).toBeCloseTo(2 / 61);
  });

  it('高排名优势：双路第一胜过单路第一', () => {
    const fused = reciprocalRankFusion([
      [
        { id: 'a', score: 1 },
        { id: 'b', score: 0.9 },
      ],
      [{ id: 'b', score: 1 }],
    ]);
    expect(fused[0]?.id).toBe('b');
  });
});
