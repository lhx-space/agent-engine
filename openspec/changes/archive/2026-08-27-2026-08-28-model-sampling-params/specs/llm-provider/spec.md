## ADDED Requirements

### Requirement: 采样参数归一化透传

系统 SHALL 把 `ModelConfig` 的采样参数作为「缺省值」透传给底层 SDK，`ChatCompletionParams` 的同名字段作为「单次调用覆盖」（`params.X ?? config.X`）；Provider SHALL 仅透传其底层协议支持的字段（openai-compatible：`temperature` / `top_p` / `max_tokens` / `frequency_penalty` / `presence_penalty` / `stop` / `seed`；anthropic：`temperature` / `top_p` / `max_tokens` / `stop_sequences`），不支持的字段静默忽略。

#### Scenario: 配置缺省生效

- **WHEN** `ModelConfig` 声明 `topP=0.7` 且 `ChatCompletionParams` 未声明 `topP`
- **THEN** 底层请求 `top_p` 为 0.7

#### Scenario: 调用覆盖优先

- **WHEN** `ChatCompletionParams.topP=0.3` 且 `ModelConfig.topP=0.7`
- **THEN** 底层请求 `top_p` 为 0.3

#### Scenario: temperature 与 maxTokens 生效

- **WHEN** `ModelConfig` 声明 `temperature=0.2` 与 `maxTokens=2048`
- **THEN** 底层请求 `temperature` 为 0.2、`max_tokens` 为 2048（不再是被忽略的死配置）

#### Scenario: OpenAI 兼容全字段透传

- **WHEN** openai-compatible Provider 配置含 `frequencyPenalty` / `presencePenalty` / `stop` / `seed`
- **THEN** 底层请求对应透传 `frequency_penalty` / `presence_penalty` / `stop` / `seed`

#### Scenario: Anthropic 交集透传与忽略

- **WHEN** anthropic Provider 配置含 `topP` / `stop` 与 `frequencyPenalty`
- **THEN** 底层请求透传 `top_p` / `stop_sequences`，忽略 `frequencyPenalty`（anthropic 不支持）
