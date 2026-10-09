# monorepo-workspace Specification

## Purpose

TBD - created by archiving change scaffold-monorepo. Update Purpose after archive.

## Requirements

### Requirement: pnpm workspace 包结构

系统 SHALL 使用 pnpm workspace 管理 `packages/*`、`packages/plugins/*`、`apps/*` 与 `docs` 四类工作区成员。

#### Scenario: 嵌套插件包被识别

- **WHEN** 在 `pnpm-workspace.yaml` 声明 `packages/plugins/*` 并执行 `pnpm install`
- **THEN** `packages/plugins/otel` 等嵌套包被识别为 workspace 成员，可被其他包以 `workspace:*` 依赖

#### Scenario: 非包目录被忽略

- **WHEN** `packages/plugins` 等目录不含 `package.json`
- **THEN** pnpm 忽略该目录，不将其视为 workspace 包

### Requirement: 单向依赖方向

包依赖 SHALL 遵循 `config ← core ← cli / platform (apps/platform, HTTP API)` 的单向依赖，禁止反向或循环依赖。

#### Scenario: 依赖方向校验

- **WHEN** 检查各包 `package.json` 的 dependencies
- **THEN** `core` 依赖 `config`，`cli` 依赖 `core`，`apps/platform` 通过 HTTP API 调用内核，无环

### Requirement: 共享 TypeScript 配置

所有包 SHALL 通过 `extends` 引用根 `tsconfig.base.json`，保持 strict 与一致的编译选项。

#### Scenario: strict 编译

- **WHEN** 执行 `pnpm typecheck`（`pnpm -r exec tsc --noEmit`）
- **THEN** 全仓各包以 `strict: true` 通过类型检查，`any` 被禁止

### Requirement: workspace 与应用布局

monorepo SHALL 新增 `apps/platform` 作为 Next.js 平台应用（App Router），并被 `pnpm-workspace.yaml` 的 `apps/*` 规则覆盖、纳入 turbo 管线（build / typecheck / lint / test）。

`agents/` SHALL 明确为**自托管/开发模式参考实现**（Next.js + 目录扫描），不与平台应用共享路由或数据访问层；`apps/web` 与 `apps/server` 在迁移完成前 SHALL 保持可构建，功能迁移完成后再下线。

#### Scenario: 新应用纳入构建

- **WHEN** 在仓库根执行构建与类型检查
- **THEN** `apps/platform` 被纳入，且与 `agents/` / `apps/web` / `apps/server` 互不干扰

#### Scenario: 自托管模式独立可用

- **WHEN** 仅运行 `agents/`
- **THEN** 目录扫描与运行链路完整可用，不依赖 `apps/platform`
