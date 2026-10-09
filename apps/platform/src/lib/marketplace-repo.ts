import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
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
import type {
  AgentDocumentRow,
  AgentMcpServerRow,
  AgentRuleRow,
  Installation,
  MarketplaceItem,
  MarketplaceVersion,
} from '@/db/schema';
import { slugify } from './agents-repo';

const DEFAULT_WORKSPACE = 'default';

// ---------------------------------------------------------------- 商品

export async function getItem(id: string): Promise<MarketplaceItem | undefined> {
  const db = getPlatformDb();
  const [row] = await db
    .select()
    .from(marketplaceItems)
    .where(eq(marketplaceItems.id, id))
    .limit(1);
  return row;
}

export async function listVersions(itemId: string): Promise<MarketplaceVersion[]> {
  const db = getPlatformDb();
  return db
    .select()
    .from(marketplaceVersions)
    .where(eq(marketplaceVersions.itemId, itemId))
    .orderBy(desc(marketplaceVersions.publishedAt));
}

export async function updateItem(
  id: string,
  patch: Partial<
    Pick<
      MarketplaceItem,
      'name' | 'summary' | 'descriptionMd' | 'status' | 'visibility' | 'tags' | 'iconUrl'
    >
  >,
): Promise<MarketplaceItem | undefined> {
  const db = getPlatformDb();
  const [row] = await db
    .update(marketplaceItems)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(marketplaceItems.id, id))
    .returning();
  return row;
}

/**
 * 删除商品：级联删版本与安装记录；已生成的 agent 实例**保留**（避免正在使用的实例失效），
 * 仅把 `sourceItemId` 置空。
 */
export async function deleteItem(id: string): Promise<boolean> {
  const db = getPlatformDb();
  await db.delete(marketplaceVersions).where(eq(marketplaceVersions.itemId, id));
  await db.delete(installations).where(eq(installations.itemId, id));
  await db
    .update(agents)
    .set({ sourceItemId: null, updatedAt: new Date() })
    .where(eq(agents.sourceItemId, id));
  const result = await db.delete(marketplaceItems).where(eq(marketplaceItems.id, id));
  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------- 安装

export async function listInstallations(): Promise<Installation[]> {
  const db = getPlatformDb();
  return db.select().from(installations).orderBy(desc(installations.createdAt));
}

export async function setInstallationEnabled(
  id: string,
  enabled: boolean,
): Promise<Installation | undefined> {
  const db = getPlatformDb();
  const [row] = await db
    .update(installations)
    .set({ enabled })
    .where(eq(installations.id, id))
    .returning();
  return row;
}

/** 卸载：删安装记录 + 关联实例（含子表）。实例由安装生成，故一并移除。 */
export async function deleteInstallation(id: string): Promise<boolean> {
  const db = getPlatformDb();
  const [row] = await db.select().from(installations).where(eq(installations.id, id)).limit(1);
  if (!row) return false;
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.sourceItemId, row.itemId), eq(agents.workspaceId, DEFAULT_WORKSPACE)))
    .limit(1);
  if (agent) await deleteAgentCascade(agent.id);
  const result = await db.delete(installations).where(eq(installations.id, id));
  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------- 实例子表

export async function listAgentRules(agentId: string): Promise<AgentRuleRow[]> {
  const db = getPlatformDb();
  return db.select().from(agentRules).where(eq(agentRules.agentId, agentId));
}

export async function addAgentRule(input: {
  agentId: string;
  ruleId: string;
  kind: string;
  description?: string;
  content: string;
  tags?: string[];
}): Promise<AgentRuleRow> {
  const db = getPlatformDb();
  const [row] = await db
    .insert(agentRules)
    .values({
      id: randomUUID(),
      agentId: input.agentId,
      ruleId: input.ruleId,
      kind: input.kind === 'always' ? 'always' : 'on-demand',
      description: input.description ?? input.ruleId,
      content: input.content,
      tags: input.tags ?? [],
    })
    .returning();
  return row!;
}

export async function deleteAgentRule(agentId: string, ruleId: string): Promise<boolean> {
  const db = getPlatformDb();
  const result = await db
    .delete(agentRules)
    .where(and(eq(agentRules.agentId, agentId), eq(agentRules.ruleId, ruleId)));
  return (result.rowCount ?? 0) > 0;
}

export async function listAgentMcpServers(agentId: string): Promise<AgentMcpServerRow[]> {
  const db = getPlatformDb();
  return db.select().from(agentMcpServers).where(eq(agentMcpServers.agentId, agentId));
}

export async function addAgentMcpServer(input: {
  agentId: string;
  name: string;
  spec: Record<string, unknown>;
}): Promise<AgentMcpServerRow> {
  const db = getPlatformDb();
  const [row] = await db
    .insert(agentMcpServers)
    .values({ id: randomUUID(), agentId: input.agentId, name: input.name, spec: input.spec })
    .returning();
  return row!;
}

export async function deleteAgentMcpServer(agentId: string, name: string): Promise<boolean> {
  const db = getPlatformDb();
  const result = await db
    .delete(agentMcpServers)
    .where(and(eq(agentMcpServers.agentId, agentId), eq(agentMcpServers.name, name)));
  return (result.rowCount ?? 0) > 0;
}

export async function listAgentDocuments(agentId: string): Promise<AgentDocumentRow[]> {
  const db = getPlatformDb();
  return db.select().from(agentDocuments).where(eq(agentDocuments.agentId, agentId));
}

export async function upsertAgentDocument(input: {
  agentId: string;
  name: string;
  content: string;
}): Promise<AgentDocumentRow> {
  const db = getPlatformDb();
  const [existing] = await db
    .select()
    .from(agentDocuments)
    .where(and(eq(agentDocuments.agentId, input.agentId), eq(agentDocuments.name, input.name)))
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(agentDocuments)
      .set({ content: input.content, size: input.content.length })
      .where(eq(agentDocuments.id, existing.id))
      .returning();
    return row!;
  }
  const [row] = await db
    .insert(agentDocuments)
    .values({
      id: randomUUID(),
      agentId: input.agentId,
      name: input.name,
      content: input.content,
      size: input.content.length,
    })
    .returning();
  return row!;
}

export async function deleteAgentDocument(agentId: string, name: string): Promise<boolean> {
  const db = getPlatformDb();
  const result = await db
    .delete(agentDocuments)
    .where(and(eq(agentDocuments.agentId, agentId), eq(agentDocuments.name, name)));
  return (result.rowCount ?? 0) > 0;
}

/** 删除实例及其全部子表（规则 / MCP / 文档）。引擎侧会话按 agentName 保留，不级联。 */
export async function deleteAgentCascade(agentId: string): Promise<boolean> {
  const db = getPlatformDb();
  await db.delete(agentRules).where(eq(agentRules.agentId, agentId));
  await db.delete(agentMcpServers).where(eq(agentMcpServers.agentId, agentId));
  await db.delete(agentDocuments).where(eq(agentDocuments.agentId, agentId));
  const result = await db.delete(agents).where(eq(agents.id, agentId));
  return (result.rowCount ?? 0) > 0;
}

/** slug 兜底：供创建/重命名时复用。 */
export { slugify };
