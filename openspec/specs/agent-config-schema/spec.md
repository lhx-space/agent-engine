# agent-config-schema Specification

## Purpose

TBD - created by archiving change add-config-schema. Update Purpose after archive.

## Requirements

### Requirement: AgentConfig 顶层结构

系统 SHALL 定义 `AgentConfig` 的 Zod Schema，包含 `name`、`description`、`version`、`model`、`systemPrompt`、`rules`、`tools`、`mcp`、`skills`、`memory`、`hooks`、`plugins`、`orchestration`、`security` 字段，并通过 `z.infer` 衍生 TS 类型。

#### Scenario: 合法配置校验通过

- **WHEN** 一份包含必需字段的配置对象传入 `AgentConfigSchema.parse()`
- **THEN** 返回类型为 `AgentConfig` 的对象，无异常

### Requirement: model 配置

系统 SHALL 定义 `model` 子 Schema，含 `provider`（openai-compatible / anthropic / custom）、`baseURL`、`model`、`temperature`、`maxTokens`；`provider` 未显式声明时 SHALL 默认为 `openai-compatible`（DeepSeek）。

#### Scenario: 默认 provider

- **WHEN** 配置未显式声明 `provider`
- **THEN** 解析结果的 `provider` 为 `openai-compatible`

### Requirement: rules 配置

系统 SHALL 定义 `rules` 子 Schema，每条规则含 `id`、`kind`（always / on-demand，加载策略）、`description`（meta 匹配面）、`content`（markdown 正文）、`tags`（同义词数组）；`kind` 未显式声明时 SHALL 默认为 `on-demand`。

#### Scenario: always 规则

- **WHEN** 一条 `kind='always'` 的规则
- **THEN** 该规则加载时强制注入，绕过检索

#### Scenario: on-demand 规则默认值

- **WHEN** 一条规则未声明 `kind`
- **THEN** 解析后 `kind` 为 `on-demand`，参与检索

#### Scenario: 规则含 content 与 tags

- **WHEN** 一条规则声明 `description`、`content`、`tags`
- **THEN** 校验通过，`tags` 作为同义词参与检索索引

### Requirement: 各配置项 Schema 齐全

系统 SHALL 为 `tools`、`mcp`、`skills`、`memory`、`hooks`、`plugins`、`orchestration` 分别定义子 Schema，覆盖 AGENTS.md 7.2 节配置示例中的全部字段。

#### Scenario: 示例配置可通过校验

- **WHEN** 将 AGENTS.md 7.2 节的 devops-agent 示例配置解析为对象并校验
- **THEN** 校验通过，无缺失字段

### Requirement: security 配置

系统 SHALL 定义 `security` 子 Schema，含 `sandbox`（`backend` 默认 `auto`、`image` 默认 `agent-engine/sandbox`、`workspaceRoot`）、`bash`（`enabled` 默认 `false`、`allowCommands`、`denyPatterns`、`allowNetwork` 默认 `false`、`timeoutMs`、`maxOutputBytes`）、`files`（`roots`、`maxFileBytes`）、`webSearch`（`provider` 默认 `duckduckgo`、`maxResults`、`timeoutMs`）、`webFetch`（`web 策略`：`allowDomains`、`denyDomains`、`timeoutMs`、`maxOutputBytes`）。

#### Scenario: security 缺省安全

- **WHEN** 配置未声明 `security`
- **THEN** 解析后 `security` 存在且 `sandbox.backend` 为 `auto`、`bash.enabled` 为 `false`、`bash.allowNetwork` 为 `false`

#### Scenario: bash 显式开启

- **WHEN** 配置声明 `security.bash.enabled: true` 与 `allowCommands` / `allowNetwork`
- **THEN** 校验通过，bash 策略字段按声明解析

#### Scenario: webSearch provider 默认

- **WHEN** 配置未声明 `security.webSearch`
- **THEN** 解析后 `webSearch.provider` 为 `duckduckgo`、`maxResults` 为默认值
