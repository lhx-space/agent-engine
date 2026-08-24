## MODIFIED Requirements

### Requirement: web_search 工具

系统 SHALL 提供 `web_search` 内置工具，经可插拔 `SearchProvider` 执行搜索，返回结构化的 `SearchResult[]`（`title` / `url` / `snippet`）；`provider` 枚举 `searxng` / `duckduckgo` / `tavily` / `serper`（默认 `searxng`），按名解析；`fallback`（默认 `duckduckgo`）在主 provider 缺失必需配置或运行期失败/空结果时按序回退；结果条数受 `maxResults` 上限约束。

#### Scenario: 返回结构化结果

- **WHEN** 以某 provider 搜索 query
- **THEN** 返回 `{ query, results }`，results 为 `SearchResult` 数组（含 title / url / snippet）

#### Scenario: 结果条数受限

- **WHEN** `maxResults` 为 N
- **THEN** 返回结果不超过 N 条

#### Scenario: 主 provider 缺配置回退

- **WHEN** `provider: searxng` 未配 `endpoint`
- **THEN** 解析结果回退到 `fallback`（duckduckgo），不因缺 endpoint 报错

#### Scenario: 运行期失败回退

- **WHEN** 主 provider `search()` 抛错或返回空结果
- **THEN** 尝试 `fallback` provider，成功则返回其结果

### Requirement: web_fetch 工具

系统 SHALL 提供 `web_fetch` 内置工具：经可注入 `fetch` 请求 URL，非 2xx 抛错；`text/html`（含 `application/xhtml+xml`）经 `Readability` 提取正文（失败退化为去标签文本），其余 `text/*` 直接返回正文文本；`content-length` 超过 `maxOutputBytes * 20` 时提前拒绝；默认带 `User-Agent`；施加超时与输出截断；执行前对 URL host 做 domain 白/黑名单校验。

#### Scenario: 提取正文

- **WHEN** URL 返回 text/html 的正文内容
- **THEN** 返回 `{ url, title, content }`，content 为提取后的正文文本（非原始 HTML）

#### Scenario: 纯文本内容

- **WHEN** URL 返回 `text/plain` 内容
- **THEN** 返回 `{ url, title, content }`，content 为该文本（不报 unsupported content-type）

#### Scenario: 非 2xx 抛错

- **WHEN** 响应状态码非 2xx
- **THEN** 抛可读错误

#### Scenario: 超长内容预检拒绝

- **WHEN** 响应 `content-length` 超过 `maxOutputBytes * 20`
- **THEN** 抛可读错误，不读取正文

#### Scenario: 拒绝域拦截

- **WHEN** URL host 命中 `denyDomains`
- **THEN** 拒绝请求且不发起 fetch
