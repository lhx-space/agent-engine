## ADDED Requirements

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
