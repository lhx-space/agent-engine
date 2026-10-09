# @lhx-agent-engine/platform

Agent Engine 的平台应用（Next.js 15 App Router）：市场 + agent 实例管理与运行。

把「目录化定义」（`agents/.lhx-agent/<name>/`）迁移为平台数据，并提供
「上架 → 安装 → 运行 → 看历史」的闭环。自托管模式仍由 `agents/` 提供。

## 数据库隔离约定（重要）

业务数据与引擎数据**必须**分开，规则如下：

|          | 引擎侧                                                                  | 平台侧                                            |
| -------- | ----------------------------------------------------------------------- | ------------------------------------------------- |
| 内容     | 会话、消息、向量、长期记忆                                              | 市场、安装、agent 实例、规则 / MCP / 文档         |
| schema   | `public`（后续迁 `engine`，见下）                                       | `platform`                                        |
| 迁移归属 | `plugin-pgvector` 自建迁移（`migrations/` + `agent_schema_migrations`） | Drizzle + drizzle-kit（`apps/platform/drizzle/`） |
| 访问方式 | 只经 `plugin-pgvector` 的 store / 原生 pg                               | Drizzle（`platform` schema）                      |
| ORM      | 无（内核插件零 ORM 依赖）                                               | drizzle-orm                                       |

三条铁律：

1. `plugin-pgvector` 等内核包**不依赖任何 ORM**，也永远不碰 `platform` schema。
2. 两层只通过**字符串 id** 软关联（平台 `agents.id` ↔ 引擎会话的 `agent_name`；`sessionId`），
   **不建跨 schema 外键**——否则两层被焊死，将来无法拆库。
3. 物理上先指向同一实例的不同 schema；若要拆库，只改 `PLATFORM_DATABASE_URL` / `ENGINE_DATABASE_URL`
   两个环境变量，业务代码无需改动。

> 待办：引擎侧目前落在 `public` schema，迁到独立的 `engine` schema 需要一次数据迁移，
> 属于后续项（`plugin-pgvector` 已支持表名配置，schema 归属待加）。

## 表结构（platform schema）

| 表                     | 用途                                                                            |
| ---------------------- | ------------------------------------------------------------------------------- |
| `marketplace_items`    | 市场商品（模板）：`type` / `slug` / `visibility` / `status` / `latestVersionId` |
| `marketplace_versions` | 不可变版本：`manifest`（jsonb，经 `AgentConfigSchema` 校验）                    |
| `installations`        | 安装关系：租户 + 商品 + 版本 + `configOverrides`                                |
| `agents`               | agent 实例：最终生效配置（版本 manifest 合并覆写后）                            |
| `agent_rules`          | `rules/*.mdc` 的迁移目标                                                        |
| `agent_mcp_servers`    | `mcps/*.yaml` 的迁移目标                                                        |
| `agent_documents`      | `context/knowledge/*.md` 的迁移目标（正文直接入库）                             |

第一版不做登录与多租户：`workspaceId` / `userId` 字段保留并填 `'default'`，
**不建** `users` / `workspaces` 表（后续接入登录时回填）。

## 市场第一版范围

- 上架类型仅 `agent` 与 `skill`；其余类型沿用同一套 item 模型扩展，不改表。
- item 是**模板**，`installations` + `agents` 构成**实例**；实例可覆写配置，覆写不回写原版本 manifest。
- 平台**不支持**执行 TypeScript hook（自托管模式才支持）：导入目录时 `hooks/*.ts` 会被忽略并列入「不支持项」。

## 使用

```bash
# 1) 生成并执行 platform 迁移
pnpm --filter @lhx-agent-engine/platform db:generate
DATABASE_URL=postgresql://agent:agent@localhost:5432/agent \
  pnpm --filter @lhx-agent-engine/platform db:migrate

# 2) 导入目录化 agent（默认 agents/.lhx-agent）
DATABASE_URL=... pnpm --filter @lhx-agent-engine/platform import:agents ../../agents/.lhx-agent

# 3) 起平台
pnpm --filter @lhx-agent-engine/platform dev
```

## API

| 方法             | 路径                                     | 说明                                              |
| ---------------- | ---------------------------------------- | ------------------------------------------------- |
| GET              | `/api/marketplace/items`                 | 市场列表（可 `?type=agent`）                      |
| POST             | `/api/marketplace/items`                 | 上架（body: `type` / `slug` / `name` / `config`） |
| GET              | `/api/marketplace/items/:id`             | 商品详情 + 版本列表                               |
| PATCH            | `/api/marketplace/items/:id`             | 改元信息（`status: deprecated` 即下架标记）       |
| DELETE           | `/api/marketplace/items/:id`             | 删商品（级联删版本/安装，实例保留但解绑）         |
| GET/POST         | `/api/marketplace/items/:id/versions`    | 版本列表 / 发布新版本（旧版本不可变）             |
| POST             | `/api/marketplace/items/:id/install`     | 安装 → 生成实例                                   |
| GET              | `/api/installations`                     | 安装列表                                          |
| PATCH            | `/api/installations/:id`                 | 启停（body: `enabled`）                           |
| DELETE           | `/api/installations/:id`                 | 卸载（删安装记录 + 关联实例与子表）               |
| GET/POST         | `/api/agents`                            | 实例列表 / 直接创建                               |
| GET/PATCH/DELETE | `/api/agents/:id`                        | 详情 / 覆写配置 / 删除（含子表）                  |
| GET/POST/DELETE  | `/api/agents/:id/rules`                  | 规则 CRUD（DELETE 用 `?ruleId=`）                 |
| GET/POST/DELETE  | `/api/agents/:id/mcp`                    | MCP server CRUD（DELETE 用 `?name=`）             |
| GET/POST/DELETE  | `/api/agents/:id/documents`              | 知识库文档 CRUD（POST 为 upsert，`?name=` 删）    |
| POST             | `/api/agents/:id/run`                    | 运行（会话 id 经 `x-session-id` 传入与回传）      |
| GET              | `/api/agents/:id/sessions`               | 会话历史列表（引擎库，按 `agentName` 软关联）     |
| GET/DELETE       | `/api/agents/:id/sessions/:sid/messages` | 会话消息（按 `seq` 升序）/ 删除会话               |
