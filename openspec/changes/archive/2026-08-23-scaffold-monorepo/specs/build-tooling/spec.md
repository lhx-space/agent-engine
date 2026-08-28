## ADDED Requirements

### Requirement: tsdown 双格式构建

每个库包 SHALL 使用 tsdown 构建出 ESM（`.mjs`）与 CJS（`.cjs`）双格式产物，并生成对应类型声明（`.d.mts` / `.d.cts`）。

#### Scenario: 构建产物齐全

- **WHEN** 执行 `pnpm build`
- **THEN** 每个 `packages/*` 包的 `dist/` 下产出 `index.mjs`、`index.cjs`、`index.d.mts`、`index.d.cts`

### Requirement: 条件导出

每个库包 SHALL 通过 `exports` 字段声明条件导出，`import` 条件指向 ESM，`require` 条件指向 CJS，并分别指向对应类型文件。

#### Scenario: ESM 导入

- **WHEN** 消费者以 `import { x } from '@lhx-agent-engine/core'` 导入
- **THEN** 解析到 `dist/index.mjs` 与 `dist/index.d.mts`

#### Scenario: CJS 导入

- **WHEN** 消费者以 `require('@lhx-agent-engine/core')` 导入
- **THEN** 解析到 `dist/index.cjs` 与 `dist/index.d.cts`

### Requirement: tree-shaking 标记

所有无副作用副作用的库包 SHALL 声明 `sideEffects: false`，以允许打包器安全摇树。

#### Scenario: 摇树友好

- **WHEN** 消费者仅导入包的单个导出
- **THEN** 打包器可安全移除未使用导出（因 `sideEffects: false`）
