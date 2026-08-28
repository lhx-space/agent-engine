## MODIFIED Requirements

### Requirement: 内置工具统一装配

系统 SHALL 提供 `registerBuiltinTools(registry, security, deps)`：恒注册**四个通用原语** `todo` / `datetime` / `web_search` / `web_fetch`，`web_search` 按 `security.webSearch.provider` 解析 `SearchProvider`；返回注册的工具名列表供上层注入规划引导。`read_file` / `write_file` / `bash` 不再内置（由内置 plugin `@lhx-agent-engine/plugin-files` / `@lhx-agent-engine/plugin-bash` 按 `config.plugins` 加载）；`sitesearch` / `calculator` / `json` / `base64` 不再内置（实现保留在 `tools/builtin/`，供 plugin 复用）。

#### Scenario: 默认装配

- **WHEN** 以缺省 `security` 调用 `registerBuiltinTools`
- **THEN** registry 含 `todo` / `datetime` / `web_search` / `web_fetch`，不含 `read_file` / `write_file` / `bash` / `sitesearch` / `calculator` / `json` / `base64`
