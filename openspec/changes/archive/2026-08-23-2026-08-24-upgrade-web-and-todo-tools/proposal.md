## Why

上一 change 的内置工具是「能跑 demo、真跑业务就废」的骨架版，三个工具需深度升级：

1. **`web_search` 没有搜索后端**：只是 fetch 一个 endpoint，没有 provider，结果也不是结构化结果。
2. **`web_fetch` 返回原始 HTML**：LLM 拿到的是标签垃圾，缺正文提取、状态码/Content-Type 判断。
3. **`todo` schema 对 LLM 不友好**：`z.discriminatedUnion` 分支匹配严格；且缺「复杂任务先列计划」的引导，任务规划承诺未兑现。

## What Changes

- **`web_search` → `SearchProvider` 可插拔**：默认 `duckduckgo`（keyless），结果归一化为结构化 `SearchResult[]`（`title` / `url` / `snippet`），`maxResults` 上限；生产可插拔 Tavily/SerpAPI/SearXNG。
- **`web_fetch` → HTML 正文提取**：引 `@mozilla/readability` + `linkedom` 提取正文文本；非 2xx 抛错、仅处理 `text/html`、超时 + 截断。
- **`todo` → 扁平 LLM 友好 schema + 规划引导**：`action` 枚举 + 可选字段（`task`/`id`/`status`），缺必需字段执行期报错；`assembleAgentLoop` 注册 todo 时向 system prompt 注入「复杂任务先列计划再执行」片段。
- **config**：`security.webSearch` 由 `endpoint` 改为 `provider`（默认 `duckduckgo`）+ `maxResults`；`webFetch` 保持 `web 策略`。

## Capabilities

### Modified Capabilities

- `builtin-tools`: `web_search`（SearchProvider + 结构化结果）、`web_fetch`（正文提取）、`todo`（扁平 schema）、`内置工具统一装配`（provider 解析 + 规划引导）。
- `agent-config-schema`: `security.webSearch` 改为 `provider` + `maxResults`。
- `plugins`: `assembleAgentLoop` 注入 todo 规划引导片段。

## Impact

- 新增 `packages/core/src/tools/builtin/search-provider.ts`（`SearchProvider` / `SearchResult`）与 `duckduckgo.ts`（keyless 后端）。
- 重写 `web-search.ts` / `web-fetch.ts` / `todo.ts`；修改 `builtin/index.ts` / `agent/assemble.ts`。
- **新增依赖**：`@mozilla/readability` + `linkedom`（core 包，复用优先）。
- 更新测试（web_search provider / web_fetch 正文提取 / todo 扁平 schema / 装配规划引导）。
- breaking：`security.webSearch.endpoint` 移除（改为 `provider`），旧配置该字段被忽略/报错。
