## MODIFIED Requirements

### Requirement: AgentConfig 顶层结构

系统 SHALL 定义 `AgentConfig` 的 Zod Schema，包含 `name`、`description`、`version`、`model`、`systemPrompt`、`rules`、`tools`、`mcp`、`skills`、`memory`、`hooks`、`plugins`、`orchestration`、`security` 字段，并通过 `z.infer` 衍生 TS 类型。

#### Scenario: 合法配置校验通过

- **WHEN** 一份包含必需字段的配置对象传入 `AgentConfigSchema.parse()`
- **THEN** 返回类型为 `AgentConfig` 的对象，无异常

## ADDED Requirements

### Requirement: security 配置

系统 SHALL 定义 `security` 子 Schema，含 `sandbox`（`backend` 默认 `auto`、`image` 默认 `agent-engine/sandbox`、`workspaceRoot`）、`bash`（`enabled` 默认 `false`、`allowCommands`、`denyPatterns`、`allowNetwork` 默认 `false`、`timeoutMs`、`maxOutputBytes`）、`files`（`roots`、`maxFileBytes`）、`webSearch`（`endpoint`、`allowDomains`、`denyDomains`、`timeoutMs`、`maxOutputBytes`）。

#### Scenario: security 缺省安全

- **WHEN** 配置未声明 `security`
- **THEN** 解析后 `security` 存在且 `sandbox.backend` 为 `auto`、`bash.enabled` 为 `false`、`bash.allowNetwork` 为 `false`

#### Scenario: bash 显式开启

- **WHEN** 配置声明 `security.bash.enabled: true` 与 `allowCommands` / `allowNetwork`
- **THEN** 校验通过，bash 策略字段按声明解析
