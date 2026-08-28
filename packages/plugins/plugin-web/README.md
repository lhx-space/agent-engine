# @lhx-agent-engine/plugin-web

Web tools plugin: registers `web_search` (pluggable `SearchProvider`: duckduckgo / searxng / tavily / serper + fallback) and `web_fetch` (domain policy + main-text extraction).

Core no longer ships web tools; this plugin interprets `security.webSearch` / `security.webFetch`.

## Install

```bash
pnpm add @lhx-agent-engine/plugin-web
```

## Usage

```ts
import { createWebPlugin } from '@lhx-agent-engine/plugin-web';

const webPlugin = createWebPlugin(config.security);

// 装配时传入 plugins: [webPlugin]
```

## API

- `createWebPlugin(security, deps?)` — returns a `Plugin` that registers `web_search` / `web_fetch`.
- `createWebSearchTool(provider, policy)` / `createWebFetchTool(policy, fetchImpl?)`.
- `createDuckDuckGoSearchProvider` / `createSearXNGSearchProvider` / `createTavilySearchProvider` / `createSerperSearchProvider` / `createFallbackSearchProvider`.
- `WebPluginDeps` — `{ searchProvider?, fetchImpl? }`.
