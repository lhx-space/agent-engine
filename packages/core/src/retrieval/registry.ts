import MiniSearch from 'minisearch';
import type { CapabilityHit, CapabilityMeta, CapabilityType } from './types';

/** 中文分词（Node 内置 Intl.Segmenter，word 粒度，零依赖）。 */
function segment(text: string): string[] {
  const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
  return [...segmenter.segment(text)].map((s) => s.segment).filter((s) => s.trim() !== '');
}

/** 统一能力注册表：注册 meta，BM25 检索召回 top-k（含得分）。 */
export class CapabilityRegistry {
  private readonly metas = new Map<string, CapabilityMeta>();
  private readonly index: MiniSearch;

  constructor() {
    this.index = new MiniSearch({
      fields: ['description', 'tags'],
      tokenize: (text) => segment(text),
    });
  }

  /** 注册能力 meta。同 id 覆盖。 */
  register(meta: CapabilityMeta): void {
    this.metas.set(meta.id, meta);
    if (this.index.has(meta.id)) {
      this.index.discard(meta.id);
    }
    this.index.add({
      id: meta.id,
      description: meta.description,
      tags: meta.tags.join(' '),
    });
  }

  /** BM25 检索，返回 top-k 候选（含得分）。 */
  retrieve(query: string, topK: number): CapabilityHit[] {
    const results = this.index.search(query);
    const hits: CapabilityHit[] = [];
    for (const result of results.slice(0, topK)) {
      const meta = this.metas.get(String(result.id));
      if (meta) {
        hits.push({ meta, score: result.score });
      }
    }
    return hits;
  }

  /** 按类型列出已注册 meta。 */
  listByType(type: CapabilityType): CapabilityMeta[] {
    return [...this.metas.values()].filter((meta) => meta.type === type);
  }
}
