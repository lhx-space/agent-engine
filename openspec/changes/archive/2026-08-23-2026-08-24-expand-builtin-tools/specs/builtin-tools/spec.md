## MODIFIED Requirements

### Requirement: 内置工具统一装配

系统 SHALL 提供 `registerBuiltinTools(registry, security, deps)`：恒注册 `todo`（规划原语），按 `deps.tools`（`ToolRef[]`，缺省 = 全部）注册 `read_file` / `write_file` / `web_search` / `web_fetch` / `sitesearch` / `calculator` / `datetime` / `json` / `base64`，`web_search` 与 `sitesearch` 按 `security.webSearch.provider` 解析 `SearchProvider`，并仅在 `security.bash.enabled` 且被请求时注册 `bash`；返回注册的工具名列表供上层注入规划引导。

#### Scenario: 默认装配

- **WHEN** 以缺省 `security` 且未提供 `deps.tools` 调用 `registerBuiltinTools`
- **THEN** registry 含 `todo` / `read_file` / `write_file` / `web_search` / `web_fetch` / `sitesearch` / `calculator` / `datetime` / `json` / `base64`，不含 `bash`

#### Scenario: 按 tools 引用过滤

- **WHEN** 提供 `deps.tools = [{ use: 'builtin.read_file' }]`
- **THEN** registry 含 `todo`（恒注册）与 `read_file`，不含其余内置工具与 `bash`

#### Scenario: 开启 bash 装配

- **WHEN** `security.bash.enabled` 为 true 且提供可用沙箱
- **THEN** registry 含 `bash`

## ADDED Requirements

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

- **WHEN** 调用 `action: format` 传入时间戳
- **THEN** 返回格式化后的本地/ISO 字符串

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
