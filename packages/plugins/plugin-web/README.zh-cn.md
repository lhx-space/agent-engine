# @lhx-agent-engine/plugin-web

Web 工具插件：注册 `web_search`（可插拔 `SearchProvider`：duckduckgo / searxng / tavily / serper + fallback）与 `web_fetch`（domain 约束 + 正文提取）。

core 不再内置 web 工具；本插件解释 `security.webSearch` / `security.webFetch`。

## 安装

```bash
pnpm add @lhx-agent-engine/plugin-web
```

## 用法

```ts
import { createWebPlugin } from '@lhx-agent-engine/plugin-web';

const webPlugin = createWebPlugin(config.security);

// 装配时传入 plugins: [webPlugin]
```

## API

- `createWebPlugin(security, deps?)` — 返回注册 `web_search` / `web_fetch` 的 `Plugin`。
- `createWebSearchTool(provider, policy)` / `createWebFetchTool(policy, fetchImpl?)`。
- `createDuckDuckGoSearchProvider` / `createSearXNGSearchProvider` / `createTavilySearchProvider` / `createSerperSearchProvider` / `createFallbackSearchProvider`。
- `WebPluginDeps` — `{ searchProvider?, fetchImpl? }`。
