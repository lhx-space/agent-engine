## Why

`@lhx-agent-engine/core` 目前只有单一入口（`src/index.ts`）+ 单一 `exports` 条件 `.`，所有能力（LLM SDK、readability、MCP、tools、sandbox…）被打进一个 barrel。用户（尤其写 plugin 的开发者）只想 `import { ToolRegistry, createReadFileTool } from '@lhx-agent-engine/core/tools'`，却被迫整包引入，既不利于 tree-shaking，也与「core = 适配器 + 各能力分层」的定位不符。`@lhx-agent-engine/config` 已示范了 `./schema` 子路径，core 应补齐同款。

## What Changes

- `@lhx-agent-engine/core` 新增**按模块子路径导出**：`.` 保留整包 barrel（向后兼容），另开 15 个子路径一一对应 `src/` 顶层模块——`agent / capability / capability-source / context / hooks / llm / mcp / memory / plugins / resolve / retrieval / rules / sandbox / skills / tools`。
- 为缺 `index.ts` 的 6 个模块（`agent` / `hooks` / `llm` / `retrieval` / `rules` / `tools`）补 re-export 入口。
- `tsdown.config.ts` 改多入口（`entry` 对象）；`package.json` 的 `exports` 按 `./schema` 同款条件写法补齐 15 个子路径（ESM/CJS + types）。

## Capabilities

### Modified Capabilities

- `build-tooling`: 新增「子路径导出」需求——库包可为高频模块暴露子路径导出，条件写法与主入口一致。

## Impact

- 新增 `packages/core/src/{agent,hooks,llm,retrieval,rules,tools}/index.ts`（6 个 re-export 入口）。
- 修改 `packages/core/tsdown.config.ts`、`packages/core/package.json`。
- 更新 `AGENTS.md`（4 节目录树注释 + 新增「内核职责边界」小节）。
- **非破坏**：`.` 主入口与既有 `from '@lhx-agent-engine/core'` 导入全部保持不变。
