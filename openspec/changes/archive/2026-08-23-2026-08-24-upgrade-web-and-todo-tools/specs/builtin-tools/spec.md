## MODIFIED Requirements

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

系统 SHALL 提供 `web_search` 内置工具，经可插拔 `SearchProvider` 执行搜索，返回结构化的 `SearchResult[]`（`title` / `url` / `snippet`）；默认 `duckduckgo`（keyless），`provider` 按名解析；结果条数受 `maxResults` 上限约束。

#### Scenario: 返回结构化结果

- **WHEN** 以默认 duckduckgo provider 搜索 query
- **THEN** 返回 `{ query, results }`，results 为 `SearchResult` 数组（含 title / url / snippet）

#### Scenario: 结果条数受限

- **WHEN** `maxResults` 为 N
- **THEN** 返回结果不超过 N 条

### Requirement: web_fetch 工具

系统 SHALL 提供 `web_fetch` 内置工具：经可注入 `fetch` 请求 URL，非 2xx 抛错、仅处理 `text/html`，并经 `Readability` 提取正文文本（提取失败退化为去标签文本），施加超时与输出截断；执行前对 URL host 做 domain 白/黑名单校验。

#### Scenario: 提取正文

- **WHEN** URL 返回 text/html 的正文内容
- **THEN** 返回 `{ url, title, content }`，content 为提取后的正文文本（非原始 HTML）

#### Scenario: 非 2xx 抛错

- **WHEN** 响应状态码非 2xx
- **THEN** 抛可读错误

#### Scenario: 拒绝域拦截

- **WHEN** URL host 命中 `denyDomains`
- **THEN** 拒绝请求且不发起 fetch

### Requirement: 内置工具统一装配

系统 SHALL 提供 `registerBuiltinTools(registry, security, deps)`：恒注册 `todo`（规划原语），按 `deps.tools`（`ToolRef[]`，缺省 = 全部）注册 `read_file` / `write_file` / `web_search` / `web_fetch`，`web_search` 按 `security.webSearch.provider` 解析 `SearchProvider`，并仅在 `security.bash.enabled` 且被请求时注册 `bash`；返回注册的工具名列表供上层注入规划引导。

#### Scenario: 默认装配

- **WHEN** 以缺省 `security` 且未提供 `deps.tools` 调用 `registerBuiltinTools`
- **THEN** registry 含 `todo` / `read_file` / `write_file` / `web_search` / `web_fetch`，不含 `bash`

#### Scenario: 按 tools 引用过滤

- **WHEN** 提供 `deps.tools = [{ use: 'builtin.read_file' }]`
- **THEN** registry 含 `todo`（恒注册）与 `read_file`，不含 `write_file` / `web_search` / `web_fetch` / `bash`

#### Scenario: 开启 bash 装配

- **WHEN** `security.bash.enabled` 为 true 且提供可用沙箱
- **THEN** registry 含 `bash`
