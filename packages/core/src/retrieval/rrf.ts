/** 一路已排名的候选（数组顺序即排名，index 0 = rank 1）。 */
export interface RankedCandidate {
  id: string;
  score: number;
}

/**
 * RRF（Reciprocal Rank Fusion）：多路排名融合，无需对齐各路分数尺度。
 * 对每个候选按 `Σ 1 / (k + rank)` 累加得分（rank 从 1 起），按融合分降序返回。
 * `k` 为平滑常数（常用 60），控制「高排名优势」强度。
 */
export function reciprocalRankFusion(
  lists: readonly (readonly RankedCandidate[])[],
  k = 60,
): RankedCandidate[] {
  const fused = new Map<string, number>();
  for (const list of lists) {
    for (let index = 0; index < list.length; index += 1) {
      const candidate = list[index];
      if (!candidate) continue;
      const contribution = 1 / (k + index + 1);
      fused.set(candidate.id, (fused.get(candidate.id) ?? 0) + contribution);
    }
  }
  return [...fused.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
