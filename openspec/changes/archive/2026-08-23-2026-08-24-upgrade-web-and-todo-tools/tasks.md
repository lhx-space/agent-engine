## 1. 依赖与 config

- [x] 1.1 core 新增依赖 `@mozilla/readability` + `linkedom`
- [x] 1.2 `WebSearchPolicySchema` 改为 `{ provider 默认 duckduckgo, maxResults, timeoutMs }`

## 2. SearchProvider

- [x] 2.1 定义 `SearchProvider` / `SearchResult`
- [x] 2.2 实现 `createDuckDuckGoSearchProvider`（flatten AbstractText + RelatedTopics）

## 3. web_search / web_fetch 重写

- [x] 3.1 `FetchLike` 增 `json()`，web_search 改走 SearchProvider
- [x] 3.2 web_fetch 用 readability + linkedom 提取正文，非 2xx/Content-Type 判断

## 4. todo 扁平化

- [x] 4.1 todo 入参改扁平 schema，execute 手动校验必需字段

## 5. 接线

- [x] 5.1 `registerBuiltinTools` 按 provider 名解析 SearchProvider
- [x] 5.2 `assembleAgentLoop` 注册 todo 时注入规划引导片段

## 6. 测试与导出

- [x] 6.1 web_search（duckduckgo flatten / maxResults）测试（假 fetch + json）
- [x] 6.2 web_fetch（正文提取 / 非 2xx / 拒绝域）测试
- [x] 6.3 todo（扁平 schema / 缺必需字段报错）测试
- [x] 6.4 装配（provider 解析 / 规划引导注入）测试
- [x] 6.5 导出 SearchProvider / SearchResult / DuckDuckGo provider
