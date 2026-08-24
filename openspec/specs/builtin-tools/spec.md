# builtin-tools Specification

## Purpose

TBD - created by archiving change 2026-08-24-add-builtin-tools. Update Purpose after archive.

## Requirements

### Requirement: todo 工具

系统 SHALL 提供 `todo` 内置工具，基于内存 `TodoStore`，支持 `add` / `list` / `update` / `delete` 四种 action；入参为**扁平 schema**（`action` 枚举 + `task` / `id` / `status` 可选字段），缺必需字段时执行期抛可读错误；每个 item 含 `id` / `task` / `status`（pending / in_progress / completed）。

#### Scenario: 添加并列出

- **WHEN** 调用 `action: 'add'` 且提供 `task`
- **THEN** 返回新增 item（含自动生成的 `id`、`status: pending`），随后 `action: 'list'` 返回含该 item 的列表

#### Scenario: add 缺 task 报错

- **WHEN** 调用 `action: 'add'` 但未提供 `task`
- **THEN** 抛可读错误，不新增

#### Scenario: 状态流转

- **WHEN** 调用 `action: 'update'` 传入 `id` 与 `status: 'completed'`
- **THEN** 该 item 状态更新，`list` 反映新状态

#### Scenario: 删除

- **WHEN** 调用 `action: 'delete'` 传入存在的 `id`
- **THEN** 该 item 被移除

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

### Requirement: 内置工具统一装配

系统 SHALL 提供 `registerBuiltinTools(registry, security, deps)`：恒注册**四个通用原语** `todo` / `datetime` / `web_search` / `web_fetch`，`web_search` 按 `security.webSearch.provider` 解析 `SearchProvider`；返回注册的工具名列表供上层注入规划引导。`read_file` / `write_file` / `bash` 不再内置（由内置 plugin `@agent-engine/plugin-files` / `@agent-engine/plugin-bash` 按 `config.plugins` 加载）；`sitesearch` / `calculator` / `json` / `base64` 已彻底移除（源码文件亦删除）。

#### Scenario: 默认装配

- **WHEN** 以缺省 `security` 调用 `registerBuiltinTools`
- **THEN** registry 含 `todo` / `datetime` / `web_search` / `web_fetch`，不含 `read_file` / `write_file` / `bash` / `sitesearch` / `calculator` / `json` / `base64`

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

### Requirement: datetime 工具

系统 SHALL 提供 `datetime` 内置工具，基于原生 `Date` / `Intl` 支持 `now`（当前时间）/ `format`（时间戳格式化）/ `parse`（字符串解析）三种 action。

#### Scenario: now

- **WHEN** 调用 `action: now`
- **THEN** 返回当前时间戳与 ISO 字符串

#### Scenario: format

- **WHEN** 调用 `action: format` 传入时间戳（可含 `timeZone` / `locale`）
- **THEN** 返回格式化后的本地化字符串，且 SHALL 包含星期、日期与时分秒（完整输出，避免模型反复追问）
