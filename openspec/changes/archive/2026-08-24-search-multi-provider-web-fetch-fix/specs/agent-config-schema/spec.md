## MODIFIED Requirements

### Requirement: security 配置

系统 SHALL 定义 `security` 子 Schema，含 `sandbox`（`backend` 默认 `auto`、`image` 默认 `agent-engine/sandbox`、`workspaceRoot`、`compact` 默认 `false`）、`bash`（`enabled` 默认 `false`、`allowCommands`、`denyPatterns`、`allowNetwork` 默认 `false`、`timeoutMs`、`maxOutputBytes`）、`files`（`roots`、`maxFileBytes`）、`webSearch`（`provider` 枚举 `searxng` / `duckduckgo` / `tavily` / `serper`，默认 `searxng`；`endpoint` SearXNG baseURL；`apiKey` tavily/serper key；`fallback` 默认 `duckduckgo`；`maxResults`；`timeoutMs`）、`webFetch`（`allowDomains`、`denyDomains`、`timeoutMs`、`maxOutputBytes`）。

#### Scenario: webSearch provider 默认

- **WHEN** 配置未声明 `security.webSearch`
- **THEN** 解析后 `webSearch.provider` 为 `searxng`、`fallback` 为 `duckduckgo`、`maxResults` 为默认值

#### Scenario: webSearch 显式 endpoint 与 apiKey

- **WHEN** 配置 `webSearch.endpoint` 与 `webSearch.apiKey`
- **THEN** 解析后二者被保留，供对应 provider 使用
