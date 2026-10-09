import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import type { AgentConfig } from '@lhx-agent-engine/config';
import { getPlatformDb } from '@/db/client';
import {
  agentDocuments,
  agentMcpServers,
  agentRules,
  agents,
  installations,
  marketplaceItems,
  marketplaceVersions,
} from '@/db/schema';
import type { AgentRow } from '@/db/schema';
import { mergeManifest, parseManifest } from './manifest';

/** 单个 agent 实例及其子表（规则 / MCP / 文档）。 */
export interface AgentBundle {
  agent: AgentRow;
  rules: (typeof agentRules.$inferSelect)[];
  mcpServers: (typeof agentMcpServers.$inferSelect)[];
  documents: (typeof agentDocuments.$inferSelect)[];
}

/** agent 名 → slug（平台内唯一键的一部分）。 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 按 id 读取实例 + 子表。 */
export async function getAgentBundle(id: string): Promise<AgentBundle | undefined> {
  const db = getPlatformDb();
  const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  if (!agent) return undefined;

  const [rules, mcpServers, documents] = await Promise.all([
    db.select().from(agentRules).where(eq(agentRules.agentId, id)),
    db.select().from(agentMcpServers).where(eq(agentMcpServers.agentId, id)),
    db
      .select()
      .from(agentDocuments)
      .where(eq(agentDocuments.agentId, id))
      .orderBy(asc(agentDocuments.name)),
  ]);

  return { agent, rules, mcpServers, documents };
}

/** 列出实例（默认按更新时间倒序）。 */
export async function listAgents(): Promise<AgentRow[]> {
  const db = getPlatformDb();
  return db.select().from(agents);
}

export interface CreateAgentInput {
  name: string;
  config: AgentConfig;
  sourceItemId?: string;
}

/** 直接创建实例（不走市场）。 */
export async function createAgent(input: CreateAgentInput): Promise<AgentRow> {
  const db = getPlatformDb();
  const id = randomUUID();
  const [row] = await db
    .insert(agents)
    .values({
      id,
      name: input.name,
      slug: slugify(input.name),
      ...(input.sourceItemId ? { sourceItemId: input.sourceItemId } : {}),
      config: JSON.parse(JSON.stringify(input.config)) as Record<string, unknown>,
    })
    .returning();
  return row!;
}

/** 更新实例配置（覆写），不触碰来源版本 manifest。 */
export async function updateAgentConfig(
  id: string,
  config: Record<string, unknown>,
): Promise<AgentRow | undefined> {
  const db = getPlatformDb();
  const [row] = await db
    .update(agents)
    .set({ config, updatedAt: new Date() })
    .where(eq(agents.id, id))
    .returning();
  return row;
}

/** 把子表（rules / mcpServers / documents）折叠进 AgentConfig，得到可运行的完整配置。 */
export function toRunnableConfig(bundle: AgentBundle): AgentConfig | undefined {
  const parsed = parseManifest(bundle.agent.config);
  if (!parsed.ok) return undefined;

  const rules = bundle.rules.map((rule) => ({
    id: rule.ruleId,
    kind: rule.kind === 'always' ? ('always' as const) : ('on-demand' as const),
    description: rule.description ?? rule.ruleId,
    content: rule.content,
    tags: rule.tags,
  }));
  const mcpServers = bundle.mcpServers.map((server) => server.spec);
  const documents = bundle.documents.map((doc) => doc.name);

  return {
    ...parsed.config,
    ...(rules.length > 0 ? { rules } : {}),
    ...(mcpServers.length > 0 ? { mcp: { servers: mcpServers } } : {}),
    ...(documents.length > 0
      ? {
          documents: {
            ...(parsed.config.documents ?? {}),
            sources: documents,
          },
        }
      : {}),
  } as AgentConfig;
}

export interface InstallResult {
  installationId: string;
  agentId: string;
}

/**
 * 安装市场商品：item → 取 latestVersionId → 合并覆写 → 生成 installation + agent 实例。
 * 版本 manifest 不会被修改。
 */
export async function installItem(
  itemId: string,
  overrides: Record<string, unknown> = {},
): Promise<InstallResult> {
  const db = getPlatformDb();
  const [item] = await db
    .select()
    .from(marketplaceItems)
    .where(eq(marketplaceItems.id, itemId))
    .limit(1);
  if (!item) throw new Error(`市场商品不存在: ${itemId}`);
  if (item.type !== 'agent' && item.type !== 'skill') {
    throw new Error(`第一版仅支持安装 agent / skill，当前类型: ${item.type}`);
  }
  if (!item.latestVersionId) throw new Error(`商品尚无已发布版本: ${itemId}`);

  const [version] = await db
    .select()
    .from(marketplaceVersions)
    .where(eq(marketplaceVersions.id, item.latestVersionId))
    .limit(1);
  if (!version) throw new Error(`版本不存在: ${item.latestVersionId}`);

  const parsed = parseManifest(version.manifest);
  if (!parsed.ok) {
    throw new Error(`版本 manifest 与当前 Schema 不兼容，需升级: ${parsed.issues.join('; ')}`);
  }

  const config = mergeManifest(version.manifest, overrides);
  const slug = slugify(item.name);
  const [existing] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.workspaceId, 'default'), eq(agents.slug, slug)))
    .limit(1);
  if (existing) {
    throw new Error(`已安装过同名实例：${slug}（agentId=${existing.id}）`);
  }

  const installationId = randomUUID();
  await db.insert(installations).values({
    id: installationId,
    itemId,
    versionId: version.id,
    configOverrides: overrides,
  });

  const agent = await createAgent({
    name: item.name,
    config: config as AgentConfig,
    sourceItemId: itemId,
  });
  return { installationId, agentId: agent.id };
}
