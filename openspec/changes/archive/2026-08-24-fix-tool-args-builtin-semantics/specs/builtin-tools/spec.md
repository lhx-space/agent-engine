## MODIFIED Requirements

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
