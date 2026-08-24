## MODIFIED Requirements

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

## ADDED Requirements

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
