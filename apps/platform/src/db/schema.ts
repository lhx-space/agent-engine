import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * 平台业务库（与引擎库隔离，见 README 的「隔离约定」）。
 *
 * 铁律：
 * 1. 这里的表**只属于 platform schema**，不引用 `engine` schema 的任何表；
 * 2. 与引擎侧只通过字符串 id 软关联（如 `agents.id` ↔ 引擎会话的 `agent_name`），
 *    **不建跨 schema 外键**——否则两层被焊死，无法拆库。
 */
export const platform = pgSchema('platform');

/** 市场商品（模板）：第一版仅 `agent` 与 `skill` 两类。 */
export const marketplaceItems = platform.table(
  'marketplace_items',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    summary: text('summary'),
    descriptionMd: text('description_md'),
    authorWorkspaceId: text('author_workspace_id').notNull().default('default'),
    /** public | unlisted | private */
    visibility: text('visibility').notNull().default('public'),
    /** draft | published | deprecated */
    status: text('status').notNull().default('published'),
    iconUrl: text('icon_url'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    latestVersionId: text('latest_version_id'),
    stats: jsonb('stats').$type<Record<string, number>>().notNull().default({}),
    // 单租户占位：第一版不做登录，全部填 'default'。
    workspaceId: text('workspace_id').notNull().default('default'),
    userId: text('user_id').notNull().default('default'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_marketplace_items_slug').on(table.slug),
    index('idx_marketplace_items_scope').on(table.type, table.status),
  ],
);

/** 商品版本：一经发布不可变，更新必须发新版本。 */
export const marketplaceVersions = platform.table(
  'marketplace_versions',
  {
    id: text('id').primaryKey(),
    itemId: text('item_id').notNull(),
    version: text('version').notNull(),
    /** 归一化后的 AgentConfig（jsonb，写入/读取均经 Zod 校验）。 */
    manifest: jsonb('manifest').$type<Record<string, unknown>>().notNull(),
    readmeMd: text('readme_md'),
    changelog: text('changelog'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('idx_marketplace_versions_unique').on(table.itemId, table.version)],
);

/** 安装关系：某租户装了某商品的某版本 + 租户级覆写。 */
export const installations = platform.table(
  'installations',
  {
    id: text('id').primaryKey(),
    itemId: text('item_id').notNull(),
    versionId: text('version_id').notNull(),
    /** 租户覆写（如换模型、改规则）；与版本 manifest 合并后得到实例配置。 */
    configOverrides: jsonb('config_overrides')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    enabled: boolean('enabled').notNull().default(true),
    installedBy: text('installed_by').notNull().default('default'),
    workspaceId: text('workspace_id').notNull().default('default'),
    userId: text('user_id').notNull().default('default'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_installations_scope').on(table.workspaceId, table.itemId)],
);

/** agent 实例：由安装生成，配置可被覆写且不影响原版本。 */
export const agents = platform.table(
  'agents',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().default('default'),
    userId: text('user_id').notNull().default('default'),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    /** 来源商品（可空：直接创建的实例）。 */
    sourceItemId: text('source_item_id'),
    /** 最终生效配置（版本 manifest 合并覆写后的结果）。 */
    config: jsonb('config').$type<Record<string, unknown>>().notNull(),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_agents_slug').on(table.workspaceId, table.slug),
    index('idx_agents_scope').on(table.workspaceId, table.updatedAt),
  ],
);

/** 规则：`rules/*.mdc` 的迁移目标（也可作为 rule_set 上架）。 */
export const agentRules = platform.table(
  'agent_rules',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id').notNull(),
    ruleId: text('rule_id').notNull(),
    kind: text('kind').notNull().default('on-demand'),
    description: text('description'),
    content: text('content').notNull(),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
  },
  (table) => [uniqueIndex('idx_agent_rules_unique').on(table.agentId, table.ruleId)],
);

/** MCP server：`mcps/*.yaml` 的迁移目标。 */
export const agentMcpServers = platform.table(
  'agent_mcp_servers',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id').notNull(),
    name: text('name').notNull(),
    spec: jsonb('spec').$type<Record<string, unknown>>().notNull(),
  },
  (table) => [uniqueIndex('idx_agent_mcp_unique').on(table.agentId, table.name)],
);

/** 知识库文档：`context/knowledge/*.md` 的迁移目标（第一版直接存正文）。 */
export const agentDocuments = platform.table(
  'agent_documents',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id').notNull(),
    name: text('name').notNull(),
    content: text('content').notNull(),
    size: integer('size').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('idx_agent_documents_unique').on(table.agentId, table.name)],
);

export type MarketplaceItem = typeof marketplaceItems.$inferSelect;
export type MarketplaceVersion = typeof marketplaceVersions.$inferSelect;
export type Installation = typeof installations.$inferSelect;
export type AgentRow = typeof agents.$inferSelect;
export type AgentRuleRow = typeof agentRules.$inferSelect;
export type AgentMcpServerRow = typeof agentMcpServers.$inferSelect;
export type AgentDocumentRow = typeof agentDocuments.$inferSelect;
