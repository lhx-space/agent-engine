import MiniSearch from 'minisearch';
import type { ContextContributor } from '@agent-engine/core/context';
import type { EmbeddingProvider } from '@agent-engine/core/embedding';
import type { Plugin } from '@agent-engine/core/plugins';
import { hybridRetrieve, InMemoryVectorStore } from '@agent-engine/core/retrieval';
import type { VectorStore } from '@agent-engine/core/retrieval';
import type { Skill } from './types';

export type { Skill } from './types';
export { loadSkillFromPath } from './load';
export { createDefaultSkillSourceDeps, resolveSkill, resolveSkills } from './source';
export type { ResolvedSkill, SkillSourceDeps } from './source';

/** 中文分词（Node 内置 Intl.Segmenter，word 粒度，零依赖）。 */
function segment(text: string): string[] {
  const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
  return [...segmenter.segment(text)].map((s) => s.segment).filter((s) => s.trim() !== '');
}

/** plugin-skills 工厂选项。 */
export interface SkillsPluginOptions {
  /** 语义召回 provider（缺省仅 BM25 词法检索）。 */
  embedding?: EmbeddingProvider;
  /** 命中召回 top-k（默认 5）。 */
  topK?: number;
}

/**
 * skills 自建索引：MiniSearch 词法召回（description + tags）+ 可选向量语义召回。
 * 索引构建归插件（D3），检索编排复用 core 的 `hybridRetrieve`。
 */
class SkillIndex {
  private readonly index: MiniSearch;
  private readonly records = new Map<string, Skill>();
  private readonly embedding: EmbeddingProvider | undefined;
  private readonly vectorStore: VectorStore | undefined;
  private vectorsBuilt = false;

  constructor(skills: Skill[], embedding?: EmbeddingProvider) {
    this.embedding = embedding;
    this.vectorStore = embedding ? new InMemoryVectorStore() : undefined;
    this.index = new MiniSearch({
      fields: ['description', 'tags'],
      tokenize: (text) => segment(text),
    });
    for (const skill of skills) {
      this.records.set(skill.id, skill);
      this.index.add({
        id: skill.id,
        description: skill.description,
        tags: skill.tags.join(' '),
      });
    }
  }

  /** 检索命中的 skills（含得分排序）；无 embedding 时纯 BM25。 */
  async retrieve(query: string, topK: number): Promise<Skill[]> {
    const lexical = (q: string, k: number) =>
      this.index
        .search(q)
        .slice(0, k)
        .map((result) => ({ id: String(result.id), score: result.score }));
    const ids =
      this.embedding && this.vectorStore
        ? await hybridRetrieve(query, topK, {
            embedding: this.embedding,
            vectorStore: this.vectorStore,
            lexical,
            ensureVectors: () => this.ensureVectors(),
          })
        : lexical(query, topK);
    return ids
      .map((candidate) => this.records.get(candidate.id))
      .filter((skill): skill is Skill => skill !== undefined);
  }

  /** 一次性把全部 skills 的 `description + tags` 向量化入库（惰性，只做一次）。 */
  private async ensureVectors(): Promise<void> {
    if (this.vectorsBuilt || !this.embedding || !this.vectorStore) return;
    this.vectorsBuilt = true;
    for (const skill of this.records.values()) {
      const [vector] = await this.embedding.embed([`${skill.description} ${skill.tags.join(' ')}`]);
      if (vector) await this.vectorStore.add([{ id: skill.id, vector }]);
    }
  }
}

/**
 * 创建 skills 上下文注入插件：注册一个 `ContextContributor`，每次 run 按 userInput
 * 检索命中的 skills，注入 instruction 文本 + 捆绑工具（run-scoped 临时注册）。
 * `config.skills` 字段的解释权移交本插件（D1-A：字段不变、零迁移）。
 */
export function createSkillsPlugin(skills: Skill[], options: SkillsPluginOptions = {}): Plugin {
  const topK = options.topK ?? 5;
  const index = skills.length > 0 ? new SkillIndex(skills, options.embedding) : undefined;

  const contributor: ContextContributor = {
    name: '@agent-engine/plugin-skills',
    async contribute({ userInput }) {
      if (!index) return undefined;
      const hits = await index.retrieve(userInput, topK);
      if (hits.length === 0) return undefined;
      const text = hits.map((hit) => `## ${hit.id}\n${hit.instruction}`).join('\n\n');
      const tools = hits.flatMap((hit) => hit.tools ?? []);
      return { text, tools };
    },
  };

  return {
    name: '@agent-engine/plugin-skills',
    description: '技能上下文注入（检索命中注入 instruction + 捆绑工具）',
    version: '0.1.0',
    tags: ['skills', '技能', '工具'],
    install(ctx) {
      ctx.registerContextContributor(contributor);
    },
  };
}
