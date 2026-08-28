## MODIFIED Requirements

### Requirement: 内置工具统一装配

系统 SHALL 提供 `registerBuiltinTools(registry, deps?)`：恒注册**两个通用原语** `todo` / `datetime`；返回注册的工具名列表供上层注入规划引导。`read_file` / `write_file` / `bash` 由内置 plugin（`@lhx-agent-engine/plugin-files` / `@lhx-agent-engine/plugin-bash`）按 `config.plugins` 加载；`web_search` / `web_fetch` 已外放为 `@lhx-agent-engine/plugin-web`；`sitesearch` / `calculator` / `json` / `base64` 已彻底移除。

#### Scenario: 默认装配

- **WHEN** 以缺省参数调用 `registerBuiltinTools`
- **THEN** registry 含 `todo` / `datetime`，不含 `read_file` / `write_file` / `bash` / `web_search` / `web_fetch` / `sitesearch` / `calculator` / `json` / `base64`

## REMOVED Requirements

### Requirement: web_search 工具

### Requirement: web_fetch 工具
