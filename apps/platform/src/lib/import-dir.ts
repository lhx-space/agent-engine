import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { AgentConfigSchema } from '@lhx-agent-engine/config';
import type { AgentConfig } from '@lhx-agent-engine/config';
import { getPlatformDb } from '@/db/client';
import {
  agentDocuments,
  agentMcpServers,
  agentRules,
  agents,
  marketplaceItems,
  marketplaceVersions,
} from '@/db/schema';
import { createAgent, slugify } from './agents-repo';
import { canonicalJson, serializeManifest } from './manifest';

/** 目录导入的产物：平台记录 + 不支持项清单。 */
export interface ImportedAgent {
  agentId: string;
  itemId: string;
  versionId: string;
  /** 平台不支持、被忽略的内容（如 TS hooks）。 */
  unsupported: string[];
}

interface RawRule {
  id: string;
  kind: string;
  description: string;
  content: string;
  tags: string[];
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function listDir(dir: string): Promise<string[]> {
  if (!(await pathExists(dir))) return [];
  return (await readdir(dir)).sort();
}

/**
 * 导入 `.lhx-agent/<name>/` 目录为平台记录：
 * - `context/system.md`（frontmatter + 正文）→ manifest
 * - `rules/*.mdc` → `agent_rules`
 * - `mcps/*.yaml` → `agent_mcp_servers`
 * - `context/knowledge/*.md` → `agent_documents`（正文入库）
 * - `hooks/*.ts` → **忽略**（平台不执行用户上传的代码，见 design 决策 8）
 */
export async function importAgentDir(dir: string): Promise<ImportedAgent> {
  const root = resolve(dir);
  const name = basename(root);
  const unsupported: string[] = [];

  const raw = await readFile(join(root, 'context', 'system.md'), 'utf-8');
  // 与自托管宿主一致：frontmatter 为配置，正文即 systemPrompt 模板。
  const matter = (await import('gray-matter')).default;
  const { data, content } = matter(raw);
  const manifest = {
    ...(data as Record<string, unknown>),
    systemPrompt: { template: content.trim(), variables: {} },
  };
  const parsed = AgentConfigSchema.safeParse(manifest);
  if (!parsed.success) {
    throw new Error(`导入失败（${name}）: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
  }
  const config: AgentConfig = parsed.data;

  // rules
  const rules: RawRule[] = [];
  for (const entry of await listDir(join(root, 'rules'))) {
    if (!entry.endsWith('.mdc')) continue;
    const file = await readFile(join(root, 'rules', entry), 'utf-8');
    const { data: ruleData, content: ruleContent } = matter(file);
    rules.push({
      id: basename(entry, '.mdc'),
      kind: ruleData.kind === 'always' ? 'always' : 'on-demand',
      description:
        typeof ruleData.description === 'string' ? ruleData.description : basename(entry, '.mdc'),
      content: ruleContent.trim(),
      tags: Array.isArray(ruleData.tags) ? (ruleData.tags as string[]) : [],
    });
  }

  // mcp servers
  const mcpServers: { name: string; spec: Record<string, unknown> }[] = [];
  for (const entry of await listDir(join(root, 'mcps'))) {
    if (!/\.(ya?ml|json)$/.test(entry)) continue;
    const file = await readFile(join(root, 'mcps', entry), 'utf-8');
    const { parse } = await import('yaml');
    mcpServers.push({
      name: basename(entry).replace(/\.(ya?ml|json)$/, ''),
      spec: parse(file) as Record<string, unknown>,
    });
  }

  // knowledge documents
  const documents: { name: string; content: string }[] = [];
  for (const entry of await listDir(join(root, 'context', 'knowledge'))) {
    if (!entry.endsWith('.md')) continue;
    documents.push({
      name: entry,
      content: await readFile(join(root, 'context', 'knowledge', entry), 'utf-8'),
    });
  }

  // hooks：平台不支持执行 TS，显式记录为不支持项。
  for (const entry of await listDir(join(root, 'hooks'))) {
    if (entry.endsWith('.ts')) unsupported.push(`hooks/${entry}（平台不支持执行 TypeScript hook）`);
  }

  const db = getPlatformDb();
  const versionId = randomUUID();
  const agentId = randomUUID();

  // 幂等导入：同名商品复用，只追加新版本；同名实例先清掉子表再重建。
  const [existingItem] = await db
    .select()
    .from(marketplaceItems)
    .where(eq(marketplaceItems.slug, name))
    .limit(1);
  const itemId = existingItem?.id ?? randomUUID();

  if (existingItem) {
    await db
      .update(marketplaceItems)
      .set({
        name: config.name,
        summary: config.description ?? name,
        latestVersionId: versionId,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceItems.id, itemId));
  } else {
    await db.insert(marketplaceItems).values({
      id: itemId,
      type: 'agent',
      slug: name,
      name: config.name,
      summary: config.description ?? name,
      status: 'published',
      visibility: 'public',
      tags: [],
      latestVersionId: versionId,
    });
  }
  await db.insert(marketplaceVersions).values({
    id: versionId,
    itemId,
    version: `${config.version ?? '1.0.0'}.${Date.now()}`,
    manifest: JSON.parse(JSON.stringify(config)) as Record<string, unknown>,
  });

  const [existingAgent] = await db
    .select()
    .from(agents)
    .where(eq(agents.slug, slugify(config.name)))
    .limit(1);
  if (existingAgent) {
    await db.delete(agentRules).where(eq(agentRules.agentId, existingAgent.id));
    await db.delete(agentMcpServers).where(eq(agentMcpServers.agentId, existingAgent.id));
    await db.delete(agentDocuments).where(eq(agentDocuments.agentId, existingAgent.id));
    await db.delete(agents).where(eq(agents.id, existingAgent.id));
  }

  const agent = await createAgent({ name: config.name, config, sourceItemId: itemId });
  void agentId;

  // 往返校验：库里读回的配置必须与目录解析出的 AgentConfig 完全一致。
  const [stored] = await db.select().from(agents).where(eq(agents.id, agent.id)).limit(1);
  if (canonicalJson(stored?.config) !== canonicalJson(serializeManifest(config))) {
    throw new Error(`导入往返校验失败（${name}）：库内配置与目录解析结果不一致`);
  }

  if (rules.length > 0) {
    await db.insert(agentRules).values(
      rules.map((rule) => ({
        id: randomUUID(),
        agentId: agent.id,
        ruleId: rule.id,
        kind: rule.kind,
        description: rule.description,
        content: rule.content,
        tags: rule.tags,
      })),
    );
  }
  if (mcpServers.length > 0) {
    await db.insert(agentMcpServers).values(
      mcpServers.map((server) => ({
        id: randomUUID(),
        agentId: agent.id,
        name: server.name,
        spec: server.spec,
      })),
    );
  }
  if (documents.length > 0) {
    await db.insert(agentDocuments).values(
      documents.map((doc) => ({
        id: randomUUID(),
        agentId: agent.id,
        name: doc.name,
        content: doc.content,
        size: doc.content.length,
      })),
    );
  }

  return { agentId: agent.id, itemId, versionId, unsupported };
}

/** 批量导入某个 harness 根目录下的全部 agent 目录。 */
export async function importHarnessRoot(root: string): Promise<ImportedAgent[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const out: ImportedAgent[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = join(root, entry.name);
    if (!(await pathExists(join(dir, 'context', 'system.md')))) continue;
    out.push(await importAgentDir(dir));
  }
  return out;
}
