## Why

`web_search` / `web_fetch` 仍是 core 内置工具（`tools/builtin/`），`registerBuiltinTools` 硬编码注册二者，且搜索 provider 实现（duckduckgo / searxng / tavily / serper）+ domain 校验 + 正文提取都在 core。这违背「能力外放、core 只留通用原语 + 协议」。

本 change 把 web 工具外放为 `@lhx-agent-engine/plugin-web`，`registerBuiltinTools` 只保留 `todo` / `datetime` 通用原语。

## What Changes

- **新增 `@lhx-agent-engine/plugin-web`**：迁入 `createWebSearchTool` / `createWebFetchTool`、`SearchProvider` + 各 provider（duckduckgo / searxng / tavily / serper + fallback）、`domain` / `html` utils；新增 `createWebPlugin(security, deps?)`（注册 `web_search` / `web_fetch`）。
- **core 删 web**：删 `tools/builtin/{web-search,web-fetch}.ts` 与 `tools/utils/{search,duckduckgo,searxng,serper,tavily,domain,html}.ts`；`registerBuiltinTools` 只注册 `todo` / `datetime`（签名移除 `security`）。
- **config 零迁移（D1-A）**：`security.webSearch` / `security.webFetch` 字段不变，解释权移交 `@lhx-agent-engine/plugin-web`。

## Capabilities

### New Capabilities

- `plugin-web`: `@lhx-agent-engine/plugin-web` 提供 `createWebPlugin` + `createWebSearchTool` / `createWebFetchTool` + 各 `SearchProvider`。

### Modified Capabilities

- `builtin-tools`: 移除 `web_search` / `web_fetch` 需求（迁至 `plugin-web`）；`registerBuiltinTools` 只注册 `todo` / `datetime`。

## Impact

- 新增 `packages/plugins/plugin-web/`（package.json / tsconfig / tsdown / src / tests / README）。
- 修改 `packages/core/src/tools/{builtin/{web-search,web-fetch,index}.ts,utils/{search,duckduckgo,searxng,serper,tavily,domain,html}.ts（删）}`、`agent/assemble.ts`、`index.ts`、`types.ts`。
- 迁移 `packages/core/tests/builtin-tools.test.ts` 的 web 用例。
- 兼容性：`security.webSearch` / `security.webFetch` 字段不变。
