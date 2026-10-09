## ADDED Requirements

### Requirement: workspace 与应用布局

monorepo SHALL 新增 `apps/platform` 作为 Next.js 平台应用（App Router），并被 `pnpm-workspace.yaml` 的 `apps/*` 规则覆盖、纳入 turbo 管线（build / typecheck / lint / test）。

`agents/` SHALL 明确为**自托管/开发模式参考实现**（Next.js + 目录扫描），不与平台应用共享路由或数据访问层；`apps/web` 与 `apps/server` 在迁移完成前 SHALL 保持可构建，功能迁移完成后再下线。

#### Scenario: 新应用纳入构建

- **WHEN** 在仓库根执行构建与类型检查
- **THEN** `apps/platform` 被纳入，且与 `agents/` / `apps/web` / `apps/server` 互不干扰

#### Scenario: 自托管模式独立可用

- **WHEN** 仅运行 `agents/`
- **THEN** 目录扫描与运行链路完整可用，不依赖 `apps/platform`
