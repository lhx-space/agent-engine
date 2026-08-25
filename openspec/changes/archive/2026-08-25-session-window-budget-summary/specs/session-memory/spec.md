## MODIFIED Requirements

### Requirement: 窗口裁剪

系统 SHALL 支持 `maxMessages`（条数，整轮边界淘汰）与 `maxTokens`（token 预算，经 `ContextCompactor` 整轮淘汰）两种裁剪；`ConversationMemory.getWindow()` SHALL 返回裁剪后的历史窗口：配置 `maxTokens` + `ContextCompactor` 时按 token 预算整轮淘汰，否则回退条数裁剪；未设置任何限制时不裁剪。裁剪点 SHALL 始终对齐到 `user` 轮次起点，不拆散 assistant `tool_call` 与其后 `tool` 结果的配对。

#### Scenario: token 预算整轮淘汰

- **WHEN** `maxTokens` 预算只容得下最近一轮
- **THEN** `getWindow()` 仅保留最近一个完整轮次，头部旧轮被淘汰

#### Scenario: 不拆散 tool_call 配对

- **WHEN** 裁剪点落在 assistant（含 tool_calls）与其 tool 结果之间
- **THEN** 裁剪点后移对齐到下一个 `user` 起点，不产生孤立 tool 消息

#### Scenario: 未设置不裁剪

- **WHEN** 未设置 `maxMessages` 与 `maxTokens`
- **THEN** 历史无限累积，不裁剪

## ADDED Requirements

### Requirement: 滚动摘要

系统 SHALL 定义 `Summarizer` 接口（`summarize(messages)` → 摘要文本）与 `LLMSummarizer` 默认（经 `LLMProvider` 摘要）。当 `summary` 开启且裁剪淘汰了旧轮时，`getWindow()` SHALL 把淘汰轮经 `Summarizer` 摘要并累积进滚动摘要，摘要作为头部 `user` 消息（含 `[历史摘要]` 标记）注入窗口；`clear()` SHALL 一并清空摘要。

#### Scenario: 淘汰轮并入摘要

- **WHEN** `summary` 开启且裁剪淘汰旧轮
- **THEN** `getWindow()` 返回窗口头部含 `[历史摘要]` 的 user 消息，正文为被淘汰轮的摘要

#### Scenario: 摘要累积

- **WHEN** 连续多次裁剪淘汰不同旧轮
- **THEN** 每次新摘要追加到既有摘要之后，不覆盖

#### Scenario: 清空摘要

- **WHEN** 调用 `clear()`
- **THEN** 历史与滚动摘要一并清空
