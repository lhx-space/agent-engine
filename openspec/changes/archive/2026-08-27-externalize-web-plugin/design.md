## Context

web 工具（`web_search` / `web_fetch`）与 files/bash 一样是「工具能力」，但历史上留在 core 的 `registerBuiltinTools`。外放后 core 只剩通用原语 `todo` / `datetime`，web 工具由 `plugin-web` 按 `config.plugins` 装配。

## Goals / Non-Goals

**Goals:**

- web 工具外放 `@agent-engine/plugin-web`。
- `registerBuiltinTools` 只注册 `todo` / `datetime`，签名移除 `security`。
- 保留搜索 provider 插拔与 domain 约束语义。

**Non-Goals:**

- 不改 `SearchProvider` / `WebSearchPolicy` / `WebPolicy` 协议与检索行为。
- 不改 `config.security.webSearch` / `webFetch` schema。

## Decisions

### D1: `createWebPlugin(security, deps?)` 承载 provider 解析

**选择**：`createWebPlugin` 内联迁入 `registerBuiltinTools` 的 `buildSearchProvider` / `resolveSearchProvider` 逻辑，`install` 注册 `web_search` / `web_fetch`。

**理由**：`security.webSearch.provider` 的解析是 web 能力入口（D1-A 解释权移交插件）。core 不再认识 `WebSearchProvider` / `SearchProvider` 的解析细节。

### D2: `registerBuiltinTools` 签名移除 `security`

**选择**：`registerBuiltinTools(registry, deps?)`，只注册 `todo` / `datetime`。

**理由**：`security` 只被 web_search 的 provider 解析使用；web 外放后 `security` 不再是 `registerBuiltinTools` 的输入。`assemble` 的调用同步改为 `registerBuiltinTools(registry)`。

### D3: 保留 `http.ts`（`defaultFetch` / `FetchLike`）于 core

**选择**：`tools/utils/http.ts` 留 core（被 embedding 的 `createEmbeddingProvider` 共享）；plugin-web 从 `@agent-engine/core` 导入 `defaultFetch` / `FetchLike`。

**理由**：`defaultFetch` 是跨能力的共享原语，不是 web 独占；`FetchLike` / `HttpResponse` 类型也是协议。web 独占的 `search` / `domain` / `html` utils 才随之外放。

## Risks / Trade-offs

- [web 工具默认失效] 外放后 `registerBuiltinTools` 不再注册 web 工具，需组合层装配 `plugin-web`（Phase 4）才生效。过渡态符合 plan。
- [DOM lib] `plugin-web` 的 `html.ts` 依赖 `Document` 全局类型，tsconfig 需加 `lib: ["ES2023", "DOM"]`（与 core 一致）。
