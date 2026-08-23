## ADDED Requirements

### Requirement: pnpm workspace 包结构

系统 SHALL 使用 pnpm workspace 管理 `packages/*`、`packages/plugins/*`、`apps/*` 与 `docs` 四类工作区成员。

#### Scenario: 嵌套插件包被识别

- **WHEN** 在 `pnpm-workspace.yaml` 声明 `packages/plugins/*` 并执行 `pnpm install`
- **THEN** `packages/plugins/otel` 等嵌套包被识别为 workspace 成员，可被其他包以 `workspace:*` 依赖

#### Scenario: 非包目录被忽略

- **WHEN** `packages/plugins` 等目录不含 `package.json`
- **THEN** pnpm 忽略该目录，不将其视为 workspace 包

### Requirement: 单向依赖方向

包依赖 SHALL 遵循 `config ← core ← cli / server ←(HTTP API) apps/web` 的单向依赖，禁止反向或循环依赖。

#### Scenario: 依赖方向校验

- **WHEN** 检查各包 `package.json` 的 dependencies
- **THEN** `core` 依赖 `config`，`cli`/`server` 依赖 `core`，`apps/web` 通过 HTTP API 调用 `server`，无环

### Requirement: 共享 TypeScript 配置

所有包 SHALL 通过 `extends` 引用根 `tsconfig.base.json`，保持 strict 与一致的编译选项。

#### Scenario: strict 编译

- **WHEN** 执行 `pnpm typecheck`（`pnpm -r exec tsc --noEmit`）
- **THEN** 全仓各包以 `strict: true` 通过类型检查，`any` 被禁止
