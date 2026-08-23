import { readFile } from 'node:fs/promises';
import matter from 'gray-matter';
import type { Skill } from './types';

/**
 * 从 SKILL.md 路径加载 Skill：gray-matter 解析 frontmatter（name → id / description / tags）
 * 与正文（instruction）。frontmatter 缺 name / description 时抛错。
 */
export async function loadSkillFromPath(path: string): Promise<Skill> {
  const source = await readFile(path, 'utf-8');
  const { data, content } = matter(source);

  if (typeof data.name !== 'string' || typeof data.description !== 'string') {
    throw new Error(`Skill "${path}" frontmatter 缺少 name / description`);
  }

  return {
    id: data.name,
    description: data.description,
    instruction: content.trim(),
    tags: Array.isArray(data.tags)
      ? data.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
  };
}
