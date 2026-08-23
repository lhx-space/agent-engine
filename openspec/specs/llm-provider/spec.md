# llm-provider Specification

## Purpose

TBD - created by archiving change add-llm-provider. Update Purpose after archive.

## Requirements

### Requirement: LLM Provider 抽象接口

系统 SHALL 定义与 SDK 无关的 `LLMProvider` 接口，含 `chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult>`，并定义 `ChatRole`、`ChatMessage`、`ToolCall`、`ToolDefinition`、`ChatCompletionParams`、`ChatCompletionResult`、`TokenUsage` 归一化类型。

#### Scenario: 接口不泄漏 SDK 类型

- **WHEN** 查看 `LLMProvider` 接口及其入参/返回类型签名
- **THEN** 不包含 `openai` 或 `@anthropic-ai/sdk` 的任何 SDK 类型

#### Scenario: 消息携带工具调用

- **WHEN** 构造一条 `role=assistant` 且含 `toolCalls` 的 `ChatMessage`
- **THEN** 每个 `toolCalls` 项含 `id`、`function.name`、`function.arguments`

#### Scenario: 工具结果消息

- **WHEN** 构造一条 `role=tool` 且含 `toolCallId` 与 `name` 的 `ChatMessage`
- **THEN** 该消息可承载工具执行结果并回填上下文

### Requirement: Provider 工厂

系统 SHALL 提供 `createProvider(config: ModelConfig): LLMProvider`，按 `config.provider` 分派到对应实现。

#### Scenario: openai-compatible 分派

- **WHEN** `config.provider` 为 `openai-compatible`
- **THEN** 返回 OpenAI 兼容 Provider 实例

#### Scenario: anthropic 分派

- **WHEN** `config.provider` 为 `anthropic`
- **THEN** 返回 Anthropic Provider 实例

#### Scenario: custom 分派

- **WHEN** `config.provider` 为 `custom` 且 `baseURL` 已提供
- **THEN** 返回 OpenAI 兼容 Provider 实例（协议假设 OpenAI 兼容）

### Requirement: OpenAI 兼容实现（默认 DeepSeek）

系统 SHALL 实现 OpenAI 兼容 Provider；`baseURL` 缺省时 SHALL 为 `https://api.deepseek.com`；apiKey SHALL 从 `DEEPSEEK_API_KEY`（回退 `OPENAI_API_KEY`）读取。

#### Scenario: 默认 baseURL

- **WHEN** `ModelConfig.baseURL` 未设置且 provider 为 `openai-compatible`
- **THEN** 底层 client 的 baseURL 为 `https://api.deepseek.com`

#### Scenario: 显式 baseURL 优先

- **WHEN** `ModelConfig.baseURL` 已设置为自定义地址
- **THEN** 底层 client 使用该自定义地址

#### Scenario: 密钥缺失报错

- **WHEN** `DEEPSEEK_API_KEY` 与 `OPENAI_API_KEY` 均未设置
- **THEN** 创建 Provider 时抛出提示需设置密钥的错误

### Requirement: Anthropic 实现

系统 SHALL 实现 Anthropic Provider，apiKey SHALL 从 `ANTHROPIC_API_KEY` 读取。

#### Scenario: 密钥缺失报错

- **WHEN** `ANTHROPIC_API_KEY` 未设置
- **THEN** 创建 Provider 时抛出提示需设置该变量的错误

#### Scenario: 消息与工具归一化

- **WHEN** 调用 `chatCompletion` 且请求含 tools 与工具结果消息
- **THEN** 内部将消息/工具适配为 Anthropic 格式，响应归一化为 `ChatCompletionResult`

### Requirement: 消息与工具归一化

Provider 实现 SHALL 在内部将 SDK 格式与归一化类型互转；`ToolDefinition.parameters` SHALL 为 JSON Schema 对象，`ToolCall.function.arguments` SHALL 为 JSON 字符串。

#### Scenario: 工具定义转出

- **WHEN** 传入 `ToolDefinition`（含 name / description / parameters）
- **THEN** 底层 SDK 收到等价的工具定义（字段映射正确）

#### Scenario: 工具调用结果归一化

- **WHEN** 模型返回工具调用（OpenAI `tool_calls` 或 Anthropic `tool_use`）
- **THEN** 结果 `message.toolCalls` 中每项含 `id` 与 `function.arguments`（JSON 字符串）

### Requirement: 错误处理

`chatCompletion` SHALL 将底层 SDK 错误（认证失败、网络、超时）向上抛出，且错误信息可追溯到模型与 Provider。

#### Scenario: 认证失败向上抛

- **WHEN** apiKey 无效导致 API 返回 401
- **THEN** `chatCompletion` 以 rejected Promise 结束，错误含底层原因
