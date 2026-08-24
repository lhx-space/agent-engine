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

### Requirement: read_file 工具

系统 SHALL 提供 `read_file` 内置工具，仅在允许的根目录内读取文件；路径经 `resolve` + `realpath` 校验，越界（根外 / `..` / symlink 逃逸）SHALL 拒绝。

#### Scenario: 根内读取

- **WHEN** 读取根目录内存在的文件
- **THEN** 返回文件内容

#### Scenario: 越界拒绝

- **WHEN** 路径经 `realpath` 解析后落在允许根目录之外（含 symlink 逃逸）
- **THEN** 抛错且不读取

### Requirement: write_file 工具

系统 SHALL 提供 `write_file` 内置工具，仅在允许根目录内写入，且受 `maxFileBytes` 大小上限约束。

#### Scenario: 根内写入

- **WHEN** 写入目标在允许根目录内且未超上限
- **THEN** 写入成功并返回结果

#### Scenario: 越界或超限拒绝

- **WHEN** 目标越界或内容超过 `maxFileBytes`
- **THEN** 抛错且不写入

### Requirement: bash 工具

系统 SHALL 提供 `bash` 内置工具，仅在 `security.bash.enabled` 为 true 时可用；执行前 SHALL 校验 `allowCommands`（白名单，空 = 不限制）与 `denyPatterns`（黑名单，命中即拒绝），通过后经 `SandboxBackend.exec` 执行；无沙箱 SHALL 拒绝执行。

#### Scenario: 默认禁用

- **WHEN** `security.bash.enabled` 为 false
- **THEN** bash 工具不被注册

#### Scenario: 黑名单命中拒绝

- **WHEN** 命令命中 `denyPatterns` 中的模式
- **THEN** 拒绝执行且不调用沙箱

#### Scenario: 白名单放行

- **WHEN** `allowCommands` 非空且命令命中白名单、未命中黑名单
- **THEN** 经沙箱执行并返回 `SandboxExecResult`

#### Scenario: 无沙箱拒绝

- **WHEN** 沙箱后端不可用
- **THEN** 抛可读错误，绝不回退宿主进程执行

### Requirement: web_search 工具

系统 SHALL 提供 `web_search` 内置工具，经可插拔 `SearchProvider` 执行搜索，返回结构化的 `SearchResult[]`（`title` / `url` / `snippet`）；默认 `duckduckgo`（keyless），`provider` 按名解析；结果条数受 `maxResults` 上限约束。

#### Scenario: 返回结构化结果

- **WHEN** 以默认 duckduckgo provider 搜索 query
- **THEN** 返回 `{ query, results }`，results 为 `SearchResult` 数组（含 title / url / snippet）

#### Scenario: 结果条数受限

- **WHEN** `maxResults` 为 N
- **THEN** 返回结果不超过 N 条

### Requirement: 内置工具统一装配

系统 SHALL 提供 `registerBuiltinTools(registry, security, deps)`：恒注册 `todo`（规划原语）与全部内置工具 `read_file` / `write_file` / `web_search` / `web_fetch` / `sitesearch` / `calculator` / `datetime` / `json` / `base64`，`web_search` 与 `sitesearch` 按 `security.webSearch.provider` 解析 `SearchProvider`，并仅在 `security.bash.enabled` 时注册 `bash`；返回注册的工具名列表供上层注入规划引导。内置工具是系统默认能力，不受 `tools` 配置过滤。

#### Scenario: 默认装配

- **WHEN** 以缺省 `security` 调用 `registerBuiltinTools`
- **THEN** registry 含 `todo` / `read_file` / `write_file` / `web_search` / `web_fetch` / `sitesearch` / `calculator` / `datetime` / `json` / `base64`，不含 `bash`

#### Scenario: 内置工具不收窄

- **WHEN** 存在 `tools: [{ use: builtin.read_file }]` 配置
- **THEN** 除 read_file 外，其余内置工具仍全部注册（`tools` 是额外工具引用，不参与内置过滤）

#### Scenario: 开启 bash 装配

- **WHEN** `security.bash.enabled` 为 true 且提供可用沙箱
- **THEN** registry 含 `bash`

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

### Requirement: calculator 工具

系统 SHALL 提供 `calculator` 内置工具，经安全解析器（`expr-eval`）求值数学表达式并返回数值结果；禁止使用 `eval` / `Function`。

#### Scenario: 求值表达式

- **WHEN** 传入 `2 + 3 * 4`
- **THEN** 返回 `{ result: 14 }`

#### Scenario: 非法表达式报错

- **WHEN** 传入非法表达式
- **THEN** 抛可读错误

### Requirement: datetime 工具

系统 SHALL 提供 `datetime` 内置工具，基于原生 `Date` / `Intl` 支持 `now`（当前时间）/ `format`（时间戳格式化）/ `parse`（字符串解析）三种 action。

#### Scenario: now

- **WHEN** 调用 `action: now`
- **THEN** 返回当前时间戳与 ISO 字符串

#### Scenario: format

- **WHEN** 调用 `action: format` 传入时间戳（可含 `timeZone` / `locale`）
- **THEN** 返回格式化后的本地化字符串，且 SHALL 包含星期、日期与时分秒（完整输出，避免模型反复追问）

### Requirement: json 工具

系统 SHALL 提供 `json` 内置工具，支持 `parse`（解析并校验 JSON）/ `stringify`（序列化为 JSON 字符串）。

#### Scenario: parse 合法 JSON

- **WHEN** 调用 `action: parse` 传入合法 JSON 字符串
- **THEN** 返回解析后的对象

#### Scenario: parse 非法 JSON 报错

- **WHEN** 传入非法 JSON
- **THEN** 抛可读错误

### Requirement: base64 工具

系统 SHALL 提供 `base64` 内置工具，支持 `encode`（编码）/ `decode`（解码）两种 action，基于 Node `Buffer`。

#### Scenario: encode/decode 往返

- **WHEN** 先 encode 再 decode 一段文本
- **THEN** 还原为原始文本

### Requirement: sitesearch 工具

系统 SHALL 提供 `sitesearch` 内置工具，复用 `SearchProvider` 并携带 `site` 过滤，返回该站点内的结构化 `SearchResult[]`，受 `maxResults` 上限约束。

#### Scenario: 站点内搜索

- **WHEN** 传入 `query` 与 `site`
- **THEN** 以 `site` 过滤调用 SearchProvider，返回结构化结果
