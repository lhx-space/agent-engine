## Why

引擎已经具备「配置即 Agent」的能力，但 agent 的定义目前以**目录文件**形式存在（`.lhx-agent/<name>/` 下的 `system.md` / `rules/*.mdc` / `skills/` / `mcps/` / `hooks/*.ts`），只能被单一进程扫描加载：无法分发、无法版本化、无法被他人复用、也无法在界面上管理。

要把这套引擎做成 SaaS，需要两件事：一是把「目录化定义」迁移成平台数据（数据库记录 + 版本化 manifest），二是提供一个**市场**让 agent 与 skill 能上架、被安装、被实例化。

同时有一条硬约束：**业务数据必须与引擎数据隔离**。引擎侧的表（向量、记忆、会话）属于内核运行时资产，平台侧的表（用户、市场、安装、计费）属于业务资产，两者不应互相耦合——否则平台演进会绑架内核 schema，内核也无法被独立自托管。

## What Changes

- **新建 `apps/platform`**：Next.js 15 App Router 应用，承载平台 UI 与业务 API；逐步迁入 `apps/web` 的界面与 `apps/server` 的 API。`agents/` 原样保留为自托管/开发模式的参考实现。
- **平台数据层**：`platform` schema 用 Drizzle + drizzle-kit 管理；`engine` schema 仍由 `plugin-pgvector` 自建迁移管理，**Drizzle 不进入内核插件**。两个连接池，物理上先指向同一实例的不同 schema，代码按可拆库设计。
- **隔离约定**：两层唯一交集是字符串形式的 `sessionId` / `agentId`，**不建跨库外键**；`plugin-pgvector` 永远只访问 `engine` schema。
- **市场模型**：`marketplace_items`（type / visibility / status）+ `marketplace_versions`（manifest + 版本）+ `installations`（租户安装关系）。第一版上架类型仅 `agent` 与 `skill`，其余类型沿用同一套 item 模型后续扩展，不改表。
- **实例模型**：item 是**模板**，`installations` + `agents` 行构成**实例**，实例可覆写 config（换模型、改规则等）。
- **目录化迁移**：`system.md` frontmatter → `agents.config`；`rules/*.mdc` → `agent_rules`；`mcps/*.yaml` → `agent_mcp_servers`；`context/knowledge/*.md` → `agent_documents`（第一版直接存 text 列）。
- **hooks 处置**：SaaS 不允许执行用户上传的 TS（现状 `agents/` 用 jiti 加载 `hooks/*.ts`），平台第一版只支持**声明式 hook** 与 **webhook**，WASI 沙箱执行留作后续高级能力。
- **第一版不做**：登录与多租户（`user_id` / `workspace_id` 字段保留、填 `'default'`）、计费与用量统计、`runs` 运行记录表。

## Capabilities

### New Capabilities

- `platform-marketplace`: 市场模型与闭环——商品（item）与版本（version）、安装（installation）、agent 实例化与配置覆写、上架类型范围。
- `platform-data-layer`: 平台数据层与引擎隔离——双 schema / 双连接池、Drizzle 仅管 platform、软关联约定、迁移归属。

### Modified Capabilities

- `agent-config-schema`: 平台需以 Zod 对市场 manifest 做校验与版本化存储，AgentConfig 需支持从 JSON 反序列化并保留未知字段的兼容性策略。
- `monorepo-workspace`: 新增 `apps/platform` 工作区（Next.js 应用），并明确 `agents/` 定位为自托管参考实现。

## Impact

- 新增：`apps/platform`（Next.js 15 + Drizzle + antd），`packages/` 侧无需改动内核。
- 配置：`pnpm-workspace.yaml` 增加 `apps/*`（已覆盖）、turbo 管线纳入新 app。
- 依赖：`drizzle-orm` / `drizzle-kit` 仅出现在 `apps/platform`；内核与插件零新增依赖。
- 数据：`agent-engine-pgvector` 实例上新建 `platform` schema；`engine` schema 不受影响。
- 兼容：`apps/web` 与 `apps/server` 短期并存，迁移完成前不删除。
