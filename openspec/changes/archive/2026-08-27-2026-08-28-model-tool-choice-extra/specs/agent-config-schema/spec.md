## MODIFIED Requirements

### Requirement: model 配置

系统 SHALL 定义 `model` 子 Schema，含 `provider`（openai-compatible / anthropic / custom）、`baseURL`、`model`、`temperature`、`maxTokens`、`topP`（0~~1）、`frequencyPenalty`（-2~~2）、`presencePenalty`（-2~2）、`stop`（string[]）、`seed`（int），并新增 `toolChoice`（`auto` / `none` / `required` / `{ type: 'function', function: { name } }`）、`parallelToolCalls`（boolean）、`extra`（`Record<string, unknown>`，vendor 透传兜底）；`provider` 未显式声明时 SHALL 默认为 `openai-compatible`（DeepSeek）。

#### Scenario: 默认 provider

- **WHEN** 配置未显式声明 `provider`
- **THEN** 解析结果的 `provider` 为 `openai-compatible`

#### Scenario: 采样参数声明

- **WHEN** 配置声明 `model.topP=0.7`、`frequencyPenalty=0.3`、`presencePenalty=0.1`、`stop=['\n']`、`seed=42`
- **THEN** 校验通过，各字段按声明解析

#### Scenario: 越界采样参数拒绝

- **WHEN** 配置声明 `model.topP=2` 或 `model.frequencyPenalty=3`
- **THEN** 校验失败（Zod 范围约束生效）

#### Scenario: 工具调用与透传参数声明

- **WHEN** 配置声明 `model.toolChoice='required'`、`model.parallelToolCalls=false`、`model.extra={ beta: true }`
- **THEN** 校验通过，各字段按声明解析
