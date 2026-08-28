## Context

`@lhx-agent-engine/core` 是最大、依赖最重的包（openai / anthropic / mcp-sdk / readability / linkedom / minisearch / picomatch 等），但对外只有一个 `.` 入口。写 plugin（`@lhx-agent-engine/plugin-files` 等）只需 tools 层（`Tool` / `ToolRegistry` / 工具工厂）与 `Plugin` 类型，却要连带整个 barrel。对照 `@lhx-agent-engine/config` 的 `./schema` 子路径，core 应按模块拆子路径，让「用多少引多少」。

## Goals / Non-Goals

**Goals:**

- core 暴露 15 个模块子路径 + `.` 整包 barrel（向后兼容）。
- 缺入口的模块补 `index.ts`，入口只做 re-export（单一职责，无实现）。
- `tsdown` 多入口构建，`package.json` `exports` 子路径条件写法与 `config` 一致。

**Non-Goals:**

- 不拆分 core 为多个独立 npm 包（monorepo 已按 `packages/` 分包，这里是包内子路径导出）。
- 不改 `config` / plugin 包的导出（已有或后续单独评估）。
- 不把 `.` barrel 改为 `export *` 精简（保持现有显式导出，避免意外 API 面变化）。

## Decisions

### D1: 子路径 = 1:1 顶层模块目录

**选择**：以 `src/` 顶层模块为粒度，开 `agent / capability / capability-source / context / hooks / llm / mcp / memory / plugins / resolve / retrieval / rules / sandbox / skills / tools` 15 个子路径；`.` 保留整包 barrel。

**理由**：与目录结构一一对应，无「按功能臆造分组」的额外心智；每个子路径天然内聚（tools 层 / llm 层 / agent 层…）。粒度稳定、易维护、易扩展（新增模块即新增子路径）。

### D2: 入口文件只 re-export，显式命名导出（不用 `export *` 扫全模块）

**选择**：补的 `index.ts` 用显式 `export { ... }` / `export type { ... }` 逐项列出该模块公开面（与既有 `capability/index.ts`、`mcp/index.ts` 同风格）；唯一例外 `tools/index.ts` 用 `export * from './builtin'`（builtin/index.ts 本身已是显式 barrel，`export *` 等价且免维护两处清单）。

**理由**：显式导出控制 API 面，避免 `export *` 把内部 helper 意外暴露；`tools/builtin` 已是 barrel，`export *` 复用其清单、不重复枚举。

### D3: tsdown 平铺入口 + exports 条件导出

**选择**：`entry` 用平铺 key（`tools: 'src/tools/index.ts'` → `dist/tools.mjs`），`package.json` `exports` 每个子路径写 `import`/`require` + `types` 条件，指向 `dist/<name>.{mjs,cjs}` 与 `dist/<name>.d.{mts,cts}`。

**理由**：与 `config` 的 `./schema` 条件写法一致（`import`→ESM、`require`→CJS、分别 types）；平铺 key 产物命名简单（`dist/tools.mjs`），无需嵌套目录。

## Risks / Trade-offs

- [多入口产物重复] → 每个子入口自包含其内部依赖，跨入口可能有少量重复代码；这是子路径导出的标准代价，换取按需加载，可接受。
- [公开 API 面变大] → 15 个子路径意味着更多「承诺的入口」；但每个只 re-export 既有导出，无新实现，破坏面小。
- [遗漏导出] → 若某子路径漏了 barrel 里的某个名字，消费者会 import 失败；以「子路径导出 ⊇ barrel 对应模块导出」为校验标准，typecheck + 插件包改走子路径做 smoke 验证。

## Migration Plan

- `.` 主入口不变，既有 `from '@lhx-agent-engine/core'` 全部兼容，无迁移成本。
- 新增用法：`import { ToolRegistry, createReadFileTool } from '@lhx-agent-engine/core/tools'` 等。
- 后续可把 plugin 包、server 层逐步改走子路径（可选，非本次必须）。
