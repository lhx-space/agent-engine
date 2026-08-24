## MODIFIED Requirements

### Requirement: AgentConfig 顶层结构

系统 SHALL 定义 `AgentConfig` 的 Zod Schema，包含 `name`、`description`、`version`、`model`、`systemPrompt`、`rules`、`tools`、`mcp`、`skills`、`memory`、`hooks`、`plugins`、`orchestration`、`execution`、`security` 字段，并通过 `z.infer` 衍生 TS 类型。

#### Scenario: 合法配置校验通过

- **WHEN** 一份包含必需字段的配置对象传入 `AgentConfigSchema.parse()`
- **THEN** 返回类型为 `AgentConfig` 的对象，无异常

## ADDED Requirements

### Requirement: execution 配置

系统 SHALL 定义顶层 `execution` 子 Schema（可选），含 `maxSteps`（int positive，默认 10）、`maxToolCalls`（int positive，可选，默认无限制）、`timeoutMs`（int positive，可选，默认无限制）、`toolRetry`（`maxRetries` int 非负默认 0、`baseDelayMs` int 非负默认 500）、`maxContinuations`（int 非负默认 1）；未声明时 SHALL 使用上述默认值，行为与现状一致。

#### Scenario: execution 缺省对齐现状

- **WHEN** 配置未声明 `execution`
- **THEN** 解析后 `execution.maxSteps` 为 10、`toolRetry.maxRetries` 为 0、`maxContinuations` 为 1

#### Scenario: 显式覆盖预算

- **WHEN** 配置声明 `execution.maxSteps=20` 与 `execution.toolRetry.maxRetries=2`
- **THEN** 校验通过，预算与重试按声明解析
