## Context

内置工具骨架版已接入装配层，但 web_search / web_fetch / todo 三个工具离「真实可用」还有距离。本 change 深度升级这三个工具，遵循「复用优先」：搜索后端复用 DuckDuckGo（keyless），HTML 正文提取复用 `@mozilla/readability` + `linkedom`。

## Goals / Non-Goals

**Goals:**

- web_search 接入可插拔 `SearchProvider`，默认 keyless 后端，返回结构化结果。
- web_fetch 提取 HTML 正文（非原始 HTML）。
- todo 改为 LLM 友好的扁平 schema，并注入「先列计划」引导。

**Non-Goals:**

- 不接 API-key 搜索后端（Tavily/SerpAPI）实现——只留 `SearchProvider` 插口，默认 duckduckgo。
- 不做 markdown 转换（正文文本已够用；markdown 留后续可换 `turndown`）。
- todo 跨进程持久化（长期后端）留 M3。

## Decisions

### D1: `SearchProvider` 接口 + `SearchResult` 归一化

**选择**：`SearchProvider.search(query)` → `SearchResult[]`（`title` / `url` / `snippet`）。

**理由**：统一不同搜索后端的差异，tool 层只面向结构化结果；结果对 LLM 友好。

### D2: 默认 `duckduckgo`（keyless）

**选择**：默认 `DuckDuckGoSearchProvider`，走 `api.duckduckgo.com` Instant Answer JSON（`format=json&no_html=1`），flatten `AbstractText` + `RelatedTopics`。

**理由**：无 API key、开箱即搜；`provider` 字段预留 Tavily/SerpAPI/SearXNG 插口。

### D3: `web_fetch` 用 `@mozilla/readability` + `linkedom`

**选择**：`linkedom.parseHTML` 出 DOM → `new Readability(document).parse()` 提取 `textContent` / `title`；提取失败退化为去标签文本。

**理由**：readability 是正文提取的事实标准，linkedom 轻量无原生依赖；复用优先。

### D4: 非 2xx 抛错 + Content-Type 白名单

**选择**：`response.ok` 为 false 抛错；`content-type` 非 `text/html` 时抛错（或仅 text 类处理）。

**理由**：避免把 404 页面 / 二进制当正文返回。

### D5: `todo` 扁平 schema

**选择**：入参为 `{ action: 'add'|'list'|'update'|'delete', task?, id?, status? }`，执行期手动校验必需字段。

**理由**：扁平 schema 对 LLM 工具调用更稳（union 分支匹配严格是已知痛点）；校验逻辑在 execute 内，报错可读。

### D6: todo 规划引导注入

**选择**：`assembleAgentLoop` 注册 todo 后，向 system prompt 注入一段固定引导：「复杂任务先用 builtin.todo 列计划再逐步执行」。

**理由**：兑现 AGENTS.md 6.2「todo 工具 + system prompt 引导」，内核零改动。

## Risks / Trade-offs

- [DuckDuckGo Instant Answer 深度有限] → 仅提供即时答案/相关主题；全文搜索留 API-key 后端插口。
- [readability 提取失败] → 退化为去标签文本，保证有输出。
- [linkedom/readability 依赖体积] → 均为纯 JS、无原生依赖，可接受。

## Migration Plan

`security.webSearch.endpoint` → `security.webSearch.provider`（默认 `duckduckgo`）；旧字段被忽略，无兼容层（尚未有真实消费者）。
