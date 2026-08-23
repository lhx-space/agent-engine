## ADDED Requirements

### Requirement: AgentConfig 顶层结构

系统 SHALL 定义 `AgentConfig` 的 Zod Schema，包含 `name`、`description`、`version`、`model`、`systemPrompt`、`rules`、`tools`、`mcp`、`skills`、`memory`、`hooks`、`plugins`、`orchestration` 字段，并通过 `z.infer` 衍生 TS 类型。

#### Scenario: 合法配置校验通过

- **WHEN** 一份包含必需字段的配置对象传入 `AgentConfigSchema.parse()`
- **THEN** 返回类型为 `AgentConfig` 的对象，无异常

### Requirement: model 配置

系统 SHALL 定义 `model` 子 Schema，含 `provider`（openai-compatible / anthropic / custom）、`baseURL`、`model`、`temperature`、`maxTokens`；`provider` 未显式声明时 SHALL 默认为 `openai-compatible`（DeepSeek）。

#### Scenario: 默认 provider

- **WHEN** 配置未显式声明 `provider`
- **THEN** 解析结果的 `provider` 为 `openai-compatible`

### Requirement: rules 配置

系统 SHALL 定义 `rules` 子 Schema，每条规则含 `id`、`description`、`kind`（static / guardrail）、`on`（guardrail 触发的 hook 点）；`kind` 为 `guardrail` 时 `on` SHALL 为必填。

#### Scenario: guardrail 规则需指定 on

- **WHEN** 一条 `kind` 为 `guardrail` 的规则未声明 `on`
- **THEN** 校验失败并提示 `on` 为必填

### Requirement: 各配置项 Schema 齐全

系统 SHALL 为 `tools`、`mcp`、`skills`、`memory`、`hooks`、`plugins`、`orchestration` 分别定义子 Schema，覆盖 AGENTS.md 7.2 节配置示例中的全部字段。

#### Scenario: 示例配置可通过校验

- **WHEN** 将 AGENTS.md 7.2 节的 devops-agent 示例配置解析为对象并校验
- **THEN** 校验通过，无缺失字段
