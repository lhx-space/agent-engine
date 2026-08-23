## MODIFIED Requirements

### Requirement: security 配置

系统 SHALL 定义 `security` 子 Schema，含 `sandbox`（`backend` 默认 `auto`、`image` 默认 `agent-engine/sandbox`、`workspaceRoot`）、`bash`（`enabled` 默认 `false`、`allowCommands`、`denyPatterns`、`allowNetwork` 默认 `false`、`timeoutMs`、`maxOutputBytes`）、`files`（`roots`、`maxFileBytes`）、`webSearch`（继承共享 `web 策略`，另含 `endpoint`）、`webFetch`（共享 `web 策略`：`allowDomains`、`denyDomains`、`timeoutMs`、`maxOutputBytes`）。

#### Scenario: security 缺省安全

- **WHEN** 配置未声明 `security`
- **THEN** 解析后 `security` 存在且 `sandbox.backend` 为 `auto`、`bash.enabled` 为 `false`、`bash.allowNetwork` 为 `false`

#### Scenario: bash 显式开启

- **WHEN** 配置声明 `security.bash.enabled: true` 与 `allowCommands` / `allowNetwork`
- **THEN** 校验通过，bash 策略字段按声明解析

#### Scenario: web 策略默认

- **WHEN** 配置未声明 `security.webSearch` / `security.webFetch`
- **THEN** 二者解析为共享 `web 策略` 默认值（`allowDomains: []`、`denyDomains: []`、默认超时与大小上限）
