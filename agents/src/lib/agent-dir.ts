import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { AgentConfigSchema } from '@agent-engine/config';
import type { AgentConfig, McpServer, Rule, SkillRef } from '@agent-engine/config';
import type { Hook } from '@agent-engine/core';
import type { Plugin } from '@agent-engine/core/plugins';
import { createJiti } from 'jiti';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';

/** 默认 harness 根：agents/.lhx-agent（next 进程 cwd 为 agents/）。 */
const DEFAULT_HARNESS_ROOT = resolve(process.cwd(), '.lhx-agent');

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

interface MarkdownFile {
  data: Record<string, unknown>;
  content: string;
}

async function readMarkdown(p: string): Promise<MarkdownFile> {
  const raw = await readFile(p, 'utf-8');
  const { data, content } = matter(raw);
  return { data: data as Record<string, unknown>, content };
}

function toTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((t): t is string => typeof t === 'string') : [];
}

/** 扫 rules/*.mdc → Rule[]（frontmatter 标 kind/description/tags，正文即 content）。 */
async function scanRules(dir: string): Promise<Rule[]> {
  const rulesDir = join(dir, 'rules');
  if (!(await pathExists(rulesDir))) return [];
  const entries = await readdir(rulesDir);
  const rules: Rule[] = [];
  for (const entry of entries.sort()) {
    if (!entry.endsWith('.mdc')) continue;
    const { data, content } = await readMarkdown(join(rulesDir, entry));
    const id = basename(entry, '.mdc');
    rules.push({
      id,
      kind: data.kind === 'always' ? 'always' : 'on-demand',
      description: typeof data.description === 'string' ? data.description : id,
      content: content.trim(),
      tags: toTags(data.tags),
    });
  }
  return rules;
}

/** 扫 skills/<skill>/SKILL.md → SkillRef[]（path 指向 skill 目录，装配层读目录下 SKILL.md）。 */
async function scanSkills(dir: string): Promise<SkillRef[]> {
  const skillsDir = join(dir, 'skills');
  if (!(await pathExists(skillsDir))) return [];
  const entries = await readdir(skillsDir);
  const refs: SkillRef[] = [];
  for (const entry of entries.sort()) {
    const skillDir = join(skillsDir, entry);
    const info = await stat(skillDir).catch(() => null);
    if (!info?.isDirectory()) continue;
    if (!(await pathExists(join(skillDir, 'SKILL.md')))) continue;
    refs.push({ source: 'path', path: resolve(skillDir) });
  }
  return refs;
}

/** 扫 mcps/*.yaml|.yml|.json → McpServer[]（command / registry / http 三种来源）。 */
async function scanMcps(dir: string): Promise<McpServer[]> {
  const mcpsDir = join(dir, 'mcps');
  if (!(await pathExists(mcpsDir))) return [];
  const entries = await readdir(mcpsDir);
  const servers: McpServer[] = [];
  for (const entry of entries.sort()) {
    if (!/\.(ya?ml|json)$/.test(entry)) continue;
    const raw = await readFile(join(mcpsDir, entry), 'utf-8');
    servers.push(parseYaml(raw) as McpServer);
  }
  return servers;
}

/** 扫 context/knowledge/*.md → documents.sources（绝对路径）。 */
async function scanKnowledge(dir: string): Promise<string[]> {
  const knowledgeDir = join(dir, 'context', 'knowledge');
  if (!(await pathExists(knowledgeDir))) return [];
  const entries = await readdir(knowledgeDir);
  return entries
    .filter((e) => e.endsWith('.md'))
    .sort()
    .map((e) => resolve(join(knowledgeDir, e)));
}

/** 扫 hooks/*.ts → Hook[]（jiti 加载，取 default export）。 */
async function scanHooks(dir: string): Promise<Hook[]> {
  const hooksDir = join(dir, 'hooks');
  if (!(await pathExists(hooksDir))) return [];
  const entries = await readdir(hooksDir);
  const jiti = createJiti(import.meta.url);
  const hooks: Hook[] = [];
  for (const entry of entries.sort()) {
    if (!entry.endsWith('.ts')) continue;
    const mod = (await jiti.import(join(hooksDir, entry), { default: true })) as {
      default?: Hook;
      name?: string;
    };
    const hook = mod.default ?? mod;
    if (hook && typeof (hook as Hook).name === 'string') {
      hooks.push(hook as Hook);
    }
  }
  return hooks;
}

/** 把本地 hooks 包装成插件（内核经 plugin registerHook 注册）。 */
export function createLocalHooksPlugin(hooks: Hook[]): Plugin {
  return {
    name: '@local/hooks',
    description: '从 .lhx-agent/<agent>/hooks/*.ts 加载的本地 hooks',
    version: '0.0.0',
    install(ctx) {
      for (const hook of hooks) ctx.registerHook(hook);
    },
  };
}

export interface ScannedAgent {
  config: AgentConfig;
  hooks: Hook[];
}

export interface ScanAgentDirOptions {
  harnessRoot?: string;
}

/**
 * 扫描 .lhx-agent/<name>/ 目录，把「文件形式」归一化成 AgentConfig 协议 + 本地 hooks。
 *
 * 目录约定：
 * - context/system.md  → frontmatter 标量（name/model/plugins/guardrails/execution/security），正文即 systemPrompt
 * - rules/*.mdc        → 每条规则一个文件（frontmatter: kind/description/tags）
 * - skills/<skill>/SKILL.md  → 每个 skill 一个目录
 * - mcps/*.yaml        → 每个 MCP server 一个文件（含远程 http 来源）
 * - hooks/*.ts         → 每个 hook 一个文件（default export Hook 对象）
 * - context/knowledge/ → documents 知识源
 */
export async function scanAgentDir(
  name: string,
  options: ScanAgentDirOptions = {},
): Promise<ScannedAgent> {
  const harnessRoot = options.harnessRoot ?? DEFAULT_HARNESS_ROOT;
  const dir = join(harnessRoot, name);
  const { data, content } = await readMarkdown(join(dir, 'context', 'system.md'));

  const hooks = await scanHooks(dir);
  const config: Record<string, unknown> = {
    ...data,
    systemPrompt: {
      template: content.trim(),
      variables:
        data.variables && typeof data.variables === 'object'
          ? (data.variables as Record<string, unknown>)
          : {},
    },
    rules: await scanRules(dir),
    skills: await scanSkills(dir),
    mcp: { servers: await scanMcps(dir) },
  };

  if (hooks.length > 0) {
    const existing = Array.isArray(config.plugins) ? (config.plugins as string[]) : [];
    config.plugins = [...existing, '@local/hooks'];
  }

  const knowledge = await scanKnowledge(dir);
  if (knowledge.length > 0) {
    config.documents = { sources: knowledge };
  }

  return { config: AgentConfigSchema.parse(config), hooks };
}
