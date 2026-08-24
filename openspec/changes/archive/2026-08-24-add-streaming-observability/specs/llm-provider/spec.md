## ADDED Requirements

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
