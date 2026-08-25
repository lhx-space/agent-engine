# llm-provider Specification

## Purpose

TBD - created by archiving change add-llm-provider. Update Purpose after archive.

## Requirements

### Requirement: LLM Provider 抽象接口

系统 SHALL 定义与 SDK 无关的 `LLMProvider` 接口，含 `chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult>`，并定义 `ChatRole`、`ChatMessage`、`ToolCall`、`ToolDefinition`、`ChatCompletionParams`、`ChatCompletionResult`、`TokenUsage` 归一化类型；`ChatMessage` SHALL 含可选 `reasoning` 字段承载模型思考内容。

#### Scenario: 接口不泄漏 SDK 类型

- **WHEN** 查看 `LLMProvider` 接口及其入参/返回类型签名
- **THEN** 不包含 `openai` 或 `@anthropic-ai/sdk` 的任何 SDK 类型

#### Scenario: 消息携带工具调用

- **WHEN** 构造一条 `role=assistant` 且含 `toolCalls` 的 `ChatMessage`
- **THEN** 每个 `toolCalls` 项含 `id`、`function.name`、`function.arguments`

#### Scenario: 工具结果消息

- **WHEN** 构造一条 `role=tool` 且含 `toolCallId` 与 `name` 的 `ChatMessage`
- **THEN** 该消息可承载工具执行结果并回填上下文

#### Scenario: 消息可承载思考内容

- **WHEN** 模型返回思考内容（如 DeepSeek R1 的 reasoning_content）
- **THEN** 归一化后的 `ChatMessage.reasoning` 含该思考内容，与 `content` 分离

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

### Requirement: 流式 chat completion

`LLMProvider` SHALL 提供可选方法 `chatCompletionStream(params, onDelta)`：流式调用模型，文本增量经 `onDelta(delta)` 逐段回调，最终返回完整的 `ChatCompletionResult`（含 tool_calls / usage / finishReason）。

#### Scenario: 文本增量逐段回调

- **WHEN** 模型流式返回多段文本
- **THEN** 每段文本经 `onDelta` 回调，最终结果含完整拼接文本

#### Scenario: 回退非流式

- **WHEN** provider 未实现 `chatCompletionStream`
- **THEN** 调用方回退 `chatCompletion`，行为不变

#### Scenario: tool_calls 流结束聚合

- **WHEN** 流式响应中包含工具调用
- **THEN** 最终返回的 `ChatCompletionResult.message.toolCalls` 完整，不丢失分片

### Requirement: OpenAI 兼容实现透传 reasoning_content

OpenAI 兼容 Provider SHALL 透传模型的 `reasoning_content`（思考内容）：非流式读 `message.reasoning_content` 归一化为 `ChatMessage.reasoning`；流式读 `delta.reasoning_content` 分片累积，最终 `ChatMessage.reasoning` 完整。

#### Scenario: 非流式透传思考

- **WHEN** 非流式响应 `message.reasoning_content` 存在
- **THEN** `ChatMessage.reasoning` 等于该思考内容，`content` 为最终回复

#### Scenario: 流式思考分片累积

- **WHEN** 流式响应 `delta.reasoning_content` 分片到达
- **THEN** 思考分片累积为完整 `reasoning`，且经 `onDelta(delta, 'reasoning')` 回调

### Requirement: 流式 onDelta 区分思考与回复

`chatCompletionStream` 的 `onDelta` SHALL 接受第二参数 `kind`（`reasoning` / `content`，缺省 `content`）；思考增量以 `kind='reasoning'` 回调，回复增量以 `kind='content'` 回调。

#### Scenario: 思考与回复分开回调

- **WHEN** 流式先有思考增量再有回复增量
- **THEN** 思考经 `onDelta(text, 'reasoning')`、回复经 `onDelta(text, 'content')` 分别回调

#### Scenario: 缺省 kind 兼容

- **WHEN** 调用方只传一个参数（老调用）
- **THEN** 行为与以往一致，`kind` 视为 `content`

### Requirement: Anthropic tool_result 合并

Anthropic Provider SHALL 把连续的多条 `role=tool` 消息合并进单个 user 消息（content 含多个 `tool_result` block），使一个 assistant 的多个 `tool_use` 的 `tool_result` 出现在紧接的下一个 user 消息里，满足 Anthropic Messages 协议。

#### Scenario: 多个 tool_result 合并

- **WHEN** 请求含一个带多个 `toolCalls` 的 assistant 消息 + 紧随的多条 `tool` 消息
- **THEN** 底层请求中这些 tool 结果合并为单个 user 消息，`tool_result` 块数等于 tool_use 数且 `tool_use_id` 一一对应

#### Scenario: 非连续 tool 消息不合并

- **WHEN** 两条 tool 消息之间夹着 user / assistant 消息
- **THEN** 各自独立转换，不强制合并

### Requirement: 流式 tool_use 按 block index 聚合

Anthropic Provider 的 `chatCompletionStream` SHALL 按 content_block 的 `index`（而非数组下标）聚合 `tool_use` 的 input 分片，最终 `message.toolCalls` 完整且参数不丢失。

#### Scenario: text block 在前时参数不丢空

- **WHEN** 流式响应先有 text block（index 0）再有 tool_use（index 1）并分片输入
- **THEN** 最终 tool_use 的 `function.arguments` 为完整 JSON，不为空

### Requirement: createEmbeddingProvider 工厂

系统 SHALL 提供 `createEmbeddingProvider(config)` 工厂，把 `EmbeddingConfig` 解析为 `EmbeddingProvider`：对 openai-compatible `/embeddings` 端点（POST `{ model, input: string[] }`，`Authorization: Bearer {apiKey}`）复用 `FetchLike`；`embed(texts)` 返回与入参等长的向量数组，`dimension` 取配置值或首个响应向量长度。

#### Scenario: embed 一批文本

- **WHEN** 以 mock fetch 构造 provider 并 `embed(['a', 'b'])`
- **THEN** 请求 `/embeddings`（含 model 与 input），返回两条等长向量

#### Scenario: dimension 推断

- **WHEN** 配置未给 `dimension`
- **THEN** `dimension` 取首次响应向量长度
