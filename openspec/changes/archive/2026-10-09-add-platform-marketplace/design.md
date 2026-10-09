## Context

现状：引擎是「目录驱动」的——`agents/` 这个 Next.js 宿主扫描 `.lhx-agent/<name>/` 目录，把文件归一化成 `AgentConfig` 再交给内核：

```188:227:/Users/luhanxin/Desktop/agent-engine/agents/src/lib/agent-dir.ts

```

这条路径适合本地与自托管，但无法支撑分发与多实例。同时存在三个应用并存：`apps/server`（Hono，内核 API）、`apps/web`（Rsbuild SPA，含 `x-session-id` 雏形）、`agents/`（Next.js 目录化宿主）。

目标形态：一个 Next.js 平台应用 + 一个市场；引擎与插件保持自洽、可独立自托管。

## Goals / Non-Goals

**Goals:**

- 把目录化 agent 定义迁移为平台数据（版本化 manifest + 结构化子表）。
- 提供市场闭环：`agent` / `skill` 两类商品的上架、浏览、安装、实例化。
- 业务数据与引擎数据物理/逻辑隔离，两层只靠字符串 id 软关联。
- 让自托管模式（`agents/`）与平台模式共存，共享同一套内核与配置 Schema。

**Non-Goals:**

- 不做登录、多租户、计费、用量统计（字段预留，下一批）。
- 不做 `runs` 运行记录表。
- 不支持在平台执行用户上传的 TS hook（改用声明式 + webhook）。
- 不做对象存储（知识库文档第一版存 text 列）。
- 不迁移 `apps/web` / `apps/server` 的全部功能，只迁市场闭环所需部分。

## Decisions

### 决策 1：新建 `apps/platform`，而非就地升级 `agents/`

`agents/` 的目录扫描逻辑与平台模型会长期并存（一个是自托管参考实现，一个是 SaaS），就地升级会让两套语义纠缠。新建应用可让平台从零按数据模型设计，`agents/` 保持干净。

**备选**：升级 `agents/`。否决理由：目录扫描是它的核心语义，混入平台模型后两边都难维护。

### 决策 2：Drizzle 只管 platform，engine 保持原生 pg

内核插件必须零 ORM 依赖（否则 `plugin-pgvector` 变重且无法独立发布）。因此：

- `platform` schema：Drizzle + drizzle-kit（迁移成熟、贴近 SQL）
- `engine` schema：`plugin-pgvector` 自建迁移（见 `refactor-engine-persistence-schema`）

代价是两套迁移并存，但它们操作不同 schema、互不干扰，且职责边界清晰。

### 决策 3：同库双 schema 起步，代码按可拆库设计

物理上一个 PostgreSQL 实例、两个 schema（`engine` / `platform`），省运维；代码里用两个独立连接池（`engineDb` / `platformDb`），将来切库只改连接串。

### 决策 4：两层只通过字符串软关联，禁止跨 schema 外键

平台侧 `agents.id` 与引擎侧 `agent_sessions.agent_name` 之间只做字符串匹配；将来 `runs.session_id` 指向引擎会话也只用字符串。**跨 schema 外键会把两层焊死**，是直接禁止项。

### 决策 5：item 是模板，实例可覆写

`marketplace_items` + `marketplace_versions`（manifest 不可变）构成模板；`installations` 记录「谁装了哪个版本」，`agents` 行是实例化结果并持有 `config_overrides`。这样「改装来的 agent」与「升级模板」两个需求都成立：升级模板时以三路合并方式提示冲突，不强制覆盖租户改动。

**备选**：agent 本身即可上架的 item，安装即引用。否决理由：租户无法改装，且版本升级会直接改坏在用实例。

### 决策 6：manifest 用混合形态（强类型检索列 + jsonb 配置体）

检索字段（`type` / `slug` / `status` / `visibility` / `tags`）做成强类型列并建索引；配置体（`AgentConfig` JSON）整体存 jsonb，由 Zod 在写入与读取时校验。避免把整个 AgentConfig 打散成几十列（schema 演进成本高），也避免全 jsonb 无法检索。

### 决策 7：知识库先存 text 列

`agent_documents` 直接存正文与元信息，第一版最快；量大或需大文件时再迁对象存储并改为存 key。

### 决策 8：平台不支持 TS hook

现状 `agents/` 用 jiti 加载并执行 `hooks/*.ts`：

```128:142:/Users/luhanxin/Desktop/agent-engine/agents/src/lib/agent-dir.ts

```

SaaS 上这等于允许任意代码在服务端执行。平台第一版只提供**声明式 hook**（日志、审计、改写、拒绝等内置类型，配置化）与 **webhook**（回调用户服务）；WASI 沙箱执行（`FunctionSandbox`）作为后续高级能力。自托管模式仍可用 TS hook。

### 决策 9：目录化迁移映射

| 目录形式                        | 平台形式                                     |
| ------------------------------- | -------------------------------------------- |
| `.lhx-agent/<name>/`            | `agents` 一行                                |
| `context/system.md` frontmatter | `agents.config`（AgentConfig JSON）          |
| `context/system.md` 正文        | `config.systemPrompt.template`               |
| `rules/*.mdc`                   | `agent_rules` 表（亦可作为 `rule_set` 上架） |
| `skills/<x>/SKILL.md`           | marketplace item(type=skill) + installation  |
| `mcps/*.yaml`                   | `agent_mcp_servers`                          |
| `context/knowledge/*.md`        | `agent_documents`（text 列）                 |
| `hooks/*.ts`                    | 声明式 hook / webhook（不支持 TS）           |

### 决策 10：第一版「字段先于表」

`user_id` / `workspace_id` 作为列保留并填 `'default'`，但**不建** `users` / `workspaces` 表；下一批补登录时再加表并回填。避免出现空表与过早的鉴权设计。

## Risks / Trade-offs

- **[三前端并存]** `apps/web` / `apps/server` / `apps/platform` 短期共存，认知负担与构建时长增加 → 明确迁移顺序：平台先跑通市场闭环，再迁其余页面，最后下线旧应用。
- **[双迁移并存]** Drizzle 与自建迁移各管一摊，容易误用 → 文档与代码注释双重标注归属；`engine` schema 只由 `plugin-pgvector` 写，`platform` schema 只由 Drizzle 写。
- **[jsonb 配置体校验]** 旧 manifest 在 schema 演进后可能校验失败 → 读取时校验失败降级为「只读 + 提示需升级」，不阻断列表渲染。
- **[版本升级冲突]** 模板升级与租户覆写冲突 → 第一版只提示不做自动合并，人工确认。
- **[市场内容安全]** 上架内容含外部模型/工具配置（如 MCP server 地址）→ 第一版只支持公开市场的审核态标记（`status`），不做自动安全扫描。
- **[hooks 能力缺口]** 依赖 TS hook 的现有 agent 无法上平台 → 明确标注「仅自托管可用」，市场商品禁止依赖 TS hook。

## Migration Plan

1. 建 `apps/platform` 骨架（Next.js 15 App Router + antd + Drizzle），连接 `platform` schema。
2. 用 drizzle-kit 生成初始迁移（市场三张表 + agent 四张表）。
3. 写迁移脚本：把 `.lhx-agent/*` 目录批量导入为 `marketplace_items` + `agents` 行，校验往返一致（导入后再导出，与原 `AgentConfig` 对比）。
4. 平台跑通闭环：上架 → 安装 → 运行（复用自托管已验证的 `x-session-id` 链路）→ 看历史。
5. 逐步迁 `apps/web` 页面，最后下线旧应用。
6. 回滚：平台只读引擎数据，删除 `platform` schema 不影响引擎运行。

## Open Questions

- 市场是否需要审核流（`status` 之外的工作流）？第一版只用状态位，审核流后置。
- `apps/web` 与 `apps/server` 的下线时机：按功能迁移进度定，还是在平台闭环完成后一次性切换？
- 私有 item（`visibility: private`）第一版是否需要？倾向暂不开放，仅 `public`。
