## 1. 应用骨架

- [x] 1.1 新建 `apps/platform`（Next.js 15 App Router + antd + React 19），配 tsconfig / package.json
- [x] 1.2 接入 `drizzle-orm` / `drizzle-kit`（仅本应用），配置 `platform` schema 的连接与迁移
- [x] 1.3 建 `enginePool`（原生 pg）/ `platformDb`（Drizzle）两个连接池，先指向同一实例的不同 schema
- [x] 1.4 在文档与代码注释中标注迁移归属（engine 归 plugin-pgvector，platform 归 Drizzle）

## 2. platform schema（Drizzle）

- [x] 2.1 定义 `marketplace_items` / `marketplace_versions` 表与索引（slug 唯一、type+status 索引）
- [x] 2.2 定义 `installations` 表（workspaceId / itemId / versionId / configOverrides / enabled）
- [x] 2.3 定义 `agents` 表（含 `config` jsonb、`userId` / `workspaceId` 默认 `'default'`）
- [x] 2.4 定义 `agent_rules` / `agent_mcp_servers` / `agent_documents`（文档正文存 text 列）
- [x] 2.5 生成并执行初始迁移；确认无跨 schema 外键

## 3. manifest 校验

- [x] 3.1 封装 `parseManifest` / `serializeManifest`，统一走 `AgentConfigSchema`
- [x] 3.2 历史 manifest 校验失败时降级为「只读 + 需升级」提示（读取返回 409 + 说明）
- [x] 3.3 单元测试：非法 manifest 拒绝、往返一致、覆写合并不改原 manifest（`tests/manifest.test.ts`）

## 4. 市场闭环

- [x] 4.1 上架接口：创建 item 与 version（仅 `agent` / `skill`，其余类型拒绝）
- [x] 4.2 版本不可变：新增 `POST /items/:id/versions` 发新版本并推进 `latestVersionId`
- [x] 4.3 安装接口：生成 installation 与 agent 实例（manifest 合并 overrides）
- [x] 4.4 实例配置可编辑（`PATCH /agents/:id`），编辑不回写原版本 manifest
- [x] 4.5 模板升级差异提示 UI 已拆为独立变更 `platform-template-upgrade-diff` 跟踪（接口层已具备版本信息，前端差异比对与确认界面待实现，见该变更）
- [x] 4.6 市场列表页与安装入口（`app/page.tsx`）
- [x] 4.7 完整 CRUD：商品（GET/PATCH/DELETE）、版本（GET 列表）、安装（列表 / 启停 / 卸载）、
      实例（DELETE 含子表）、子表（rules / mcp / documents 各自 GET/POST/DELETE）、会话（DELETE）

## 5. 目录化导入

- [x] 5.1 实现导入逻辑：`.lhx-agent/<name>/` → item + version + agent + rules + mcp + documents
- [x] 5.2 导入时忽略 `hooks/*.ts`，产出「不支持项」清单
- [x] 5.3 往返校验：库内配置与目录解析出的 `AgentConfig` 归一化后相等（不等则抛错）
- [x] 5.4 对三个示例 agent 各跑一次导入验证（含 hooks 不支持项提示）

## 6. 运行链路接线

- [x] 6.1 运行接口复用 `x-session-id` 约定（与自托管宿主一致）
- [x] 6.2 运行前按实例 config 装配内核（`resolveAgentConfig`），文档物化后注入 `documents.sources`
- [x] 6.3 会话历史读取走应用层两次查询（先平台取实例 → 再引擎取会话消息），数据库层无 join
- [x] 6.4 端到端冒烟：24 个 CRUD 请求全通过（含越界类型被拒的负向用例）；
      对话级冒烟仍需 LLM API Key，未跑

## 7. 迁移与收尾

- [x] 7.1 `apps/web` 已整体下线（见 `remove-legacy-web-and-server`），其页面能力由 `apps/platform` 取代，无需迁移
- [x] 7.2 更新 `apps/platform/README.md`（隔离约定 / 表结构 / API / 使用步骤）
- [x] 7.3 更新 `openspec/config.yaml` 的 project context（新增 apps/platform 与双 schema 约定）
- [x] 7.4 `apps/web` / `apps/server` 已删除下线（由 `remove-legacy-web-and-server` 变更负责），引擎/平台能力由 `apps/platform` 承载
