## ADDED Requirements

### Requirement: 工具调用与透传参数归一化

系统 SHALL 把 `toolChoice` / `parallelToolCalls` / `extra` 按「配置缺省 + 调用覆盖」（`params.X ?? config.X`）透传：openai-compatible 透传 `tool_choice` / `parallel_tool_calls` / `extra`（顶层展开）；anthropic 把 `toolChoice` 映射为其 `tool_choice`（`auto`→`{ type: 'auto' }`、`none`→`{ type: 'none' }`、`required`→`{ type: 'any' }`、`{ function }`→`{ type: 'tool', name }`）并透传 `extra`，忽略 `parallelToolCalls`。`response_format` SHALL 支持 `json_schema`（openai-compatible 透传，anthropic 忽略）。

#### Scenario: OpenAI 兼容 tool_choice 透传

- **WHEN** openai-compatible Provider 配置 `toolChoice='required'`
- **THEN** 底层请求 `tool_choice` 为 `required`

#### Scenario: OpenAI 兼容 parallel_tool_calls 透传

- **WHEN** openai-compatible Provider 配置 `parallelToolCalls=false`
- **THEN** 底层请求 `parallel_tool_calls` 为 `false`

#### Scenario: Anthropic tool_choice 映射

- **WHEN** anthropic Provider 配置 `toolChoice={ type: 'function', function: { name: 'get_weather' } }`
- **THEN** 底层请求 `tool_choice` 为 `{ type: 'tool', name: 'get_weather' }`

#### Scenario: Anthropic 忽略 parallel_tool_calls

- **WHEN** anthropic Provider 配置 `parallelToolCalls=false`
- **THEN** 底层请求不含 `parallel_tool_calls`

#### Scenario: extra 顶层透传

- **WHEN** 配置 `extra={ beta: true }` 且调用未覆盖
- **THEN** 底层请求顶层含 `beta: true`

#### Scenario: response_format json_schema 透传

- **WHEN** openai-compatible Provider 收到 `responseFormat: { type: 'json_schema', json_schema: { name, schema } }`
- **THEN** 底层请求 `response_format` 为该 `json_schema` 对象
