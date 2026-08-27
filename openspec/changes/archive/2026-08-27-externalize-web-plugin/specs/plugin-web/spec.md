## ADDED Requirements

### Requirement: createWebPlugin 注册 web 工具

系统 SHALL 提供 `@agent-engine/plugin-web` 包，导出 `createWebPlugin(security, deps?)`，返回 `Plugin`；其 `install(ctx)` SHALL 注册 `web_search`（按 `security.webSearch.provider` 解析 `SearchProvider`）与 `web_fetch`。`deps` SHALL 可注入 `searchProvider` / `fetchImpl` 以便测试。

#### Scenario: 注册 web_search / web_fetch

- **WHEN** 以缺省 `security` 构造 `createWebPlugin` 并安装
- **THEN** 注册 `builtin.web_search` 与 `builtin.web_fetch`

#### Scenario: 无可用 provider 抛错

- **WHEN** `provider` 与 `fallback` 均缺必需配置（如 tavily 无 apiKey）
- **THEN** `install` 抛可读错误

### Requirement: web_search 工具

系统 SHALL 提供 `web_search` 工具，经可插拔 `SearchProvider` 执行搜索，返回结构化的 `SearchResult[]`（`title` / `url` / `snippet`）；`provider` 枚举 `searxng` / `duckduckgo` / `tavily` / `serper`，按名解析；`fallback` 在主 provider 缺失配置或运行期失败/空结果时按序回退；结果条数受 `maxResults` 上限约束。

#### Scenario: 返回结构化结果

- **WHEN** 以某 provider 搜索 query
- **THEN** 返回 `{ query, results }`，results 为 `SearchResult` 数组

#### Scenario: 运行期失败回退

- **WHEN** 主 provider `search()` 抛错或返回空结果
- **THEN** 尝试 `fallback` provider，成功则返回其结果

### Requirement: web_fetch 工具

系统 SHALL 提供 `web_fetch` 工具：经可注入 `fetch` 请求 URL，非 2xx 抛错；`text/html` 经 `Readability` 提取正文（失败退化去标签文本），其余 `text/*` 直接返回正文；`content-length` 超过 `maxOutputBytes * 20` 提前拒绝；执行前对 URL host 做 domain 白/黑名单校验。

#### Scenario: 提取正文

- **WHEN** URL 返回 text/html 的正文内容
- **THEN** 返回 `{ url, title, content }`，content 为提取后的正文文本

#### Scenario: 拒绝域拦截

- **WHEN** URL host 命中 `denyDomains`
- **THEN** 拒绝请求且不发起 fetch
