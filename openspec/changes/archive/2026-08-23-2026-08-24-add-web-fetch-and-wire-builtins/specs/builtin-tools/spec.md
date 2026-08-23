## MODIFIED Requirements

### Requirement: 内置工具统一装配

系统 SHALL 提供 `registerBuiltinTools(registry, security, deps)`：恒注册 `todo`（规划原语），按 `deps.tools`（`ToolRef[]`，缺省 = 全部）注册 `read_file` / `write_file` / `web_search` / `web_fetch`，并仅在 `security.bash.enabled` 且被请求时注册 `bash`。

#### Scenario: 默认装配

- **WHEN** 以缺省 `security` 且未提供 `deps.tools` 调用 `registerBuiltinTools`
- **THEN** registry 含 `todo` / `read_file` / `write_file` / `web_search` / `web_fetch`，不含 `bash`

#### Scenario: 按 tools 引用过滤

- **WHEN** 提供 `deps.tools = [{ use: 'builtin.read_file' }]`
- **THEN** registry 含 `todo`（恒注册）与 `read_file`，不含 `write_file` / `web_search` / `web_fetch` / `bash`

#### Scenario: 开启 bash 装配

- **WHEN** `security.bash.enabled` 为 true 且提供可用沙箱
- **THEN** registry 含 `bash`

## ADDED Requirements

### Requirement: web_fetch 工具

系统 SHALL 提供 `web_fetch` 内置工具，经可注入的 `fetch` 请求指定 URL 并返回文本；执行前对 URL host 做 domain 白/黑名单校验，并施加超时与输出截断。

#### Scenario: 允许域放行

- **WHEN** URL host 命中允许域（或未配置拒绝域）
- **THEN** 发起请求并返回（可能截断的）内容

#### Scenario: 拒绝域拦截

- **WHEN** URL host 命中 `denyDomains`
- **THEN** 拒绝请求且不发起 fetch
