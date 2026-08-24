## ADDED Requirements

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
