# build-tooling Specification

## Purpose

TBD - created by archiving change scaffold-monorepo. Update Purpose after archive.

## Requirements

### Requirement: tsdown 双格式构建

每个库包 SHALL 使用 tsdown 构建出 ESM（`.mjs`）与 CJS（`.cjs`）双格式产物，并生成对应类型声明（`.d.mts` / `.d.cts`）。

#### Scenario: 构建产物齐全

- **WHEN** 执行 `pnpm build`
- **THEN** 每个 `packages/*` 包的 `dist/` 下产出 `index.mjs`、`index.cjs`、`index.d.mts`、`index.d.cts`

### Requirement: 条件导出

每个库包 SHALL 通过 `exports` 字段声明条件导出，`import` 条件指向 ESM，`require` 条件指向 CJS，并分别指向对应类型文件。

#### Scenario: ESM 导入

- **WHEN** 消费者以 `import { x } from '@agent-engine/core'` 导入
- **THEN** 解析到 `dist/index.mjs` 与 `dist/index.d.mts`

#### Scenario: CJS 导入

- **WHEN** 消费者以 `require('@agent-engine/core')` 导入
- **THEN** 解析到 `dist/index.cjs` 与 `dist/index.d.cts`

### Requirement: tree-shaking 标记

所有无副作用副作用的库包 SHALL 声明 `sideEffects: false`，以允许打包器安全摇树。

#### Scenario: 摇树友好

- **WHEN** 消费者仅导入包的单个导出
- **THEN** 打包器可安全移除未使用导出（因 `sideEffects: false`）

### Requirement: Turborepo 构建缓存

系统 SHALL 使用 Turborepo 编排 per-package 的 `build` 与 `typecheck`：`turbo.json` 声明 `build` 缓存 `dist/**`、依赖 `^build`；`typecheck` 依赖 `^build`。root `build` / `typecheck` 脚本 SHALL 走 `turbo run`。

#### Scenario: 构建缓存

- **WHEN** 执行 `pnpm build` 后再次执行（无变更）
- **THEN** 各包命中本地缓存，跳过重复构建

#### Scenario: 依赖图编排

- **WHEN** 某包依赖的包重新构建
- **THEN** 依赖包的 `build` 先于其消费者执行（`^build`）

### Requirement: 子路径导出（subpath exports）

库包 SHALL 可为内聚模块暴露子路径导出：`package.json` 的 `exports` 为每个子路径声明 `import`（→ ESM `.mjs` + `.d.mts`）与 `require`（→ CJS `.cjs` + `.d.cts`）条件，写法与主入口一致；tsdown 以多入口（`entry` 对象）构建对应产物。`@agent-engine/core` SHALL 暴露 15 个模块子路径（`agent` / `capability` / `capability-source` / `context` / `hooks` / `llm` / `mcp` / `memory` / `plugins` / `resolve` / `retrieval` / `rules` / `sandbox` / `skills` / `tools`），并保留 `.` 整包入口向后兼容。

#### Scenario: 子路径 ESM 导入

- **WHEN** 消费者以 `import { ToolRegistry } from '@agent-engine/core/tools'` 导入
- **THEN** 解析到 `dist/tools.mjs` 与 `dist/tools.d.mts`

#### Scenario: 子路径 CJS 导入

- **WHEN** 消费者以 `require('@agent-engine/core/tools')` 导入
- **THEN** 解析到 `dist/tools.cjs` 与 `dist/tools.d.cts`

#### Scenario: 主入口向后兼容

- **WHEN** 消费者继续以 `import { x } from '@agent-engine/core'` 导入
- **THEN** 行为不变，解析到 `dist/index.mjs` / `dist/index.d.mts`
