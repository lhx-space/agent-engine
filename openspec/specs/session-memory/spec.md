# session-memory Specification

## Purpose

TBD - created by archiving change add-session-memory. Update Purpose after archive.

## Requirements

### Requirement: 会话历史管理

会话历史 SHALL 以 `sessionId` 为键组织：同一 `sessionId` 的多次运行共享同一份历史；未显式提供 `sessionId` 时 SHALL 自动生成（uuid）。

运行结束时 SHALL 将本轮消息回写到 `ConversationStore`（正常、异常、中断三条出口均覆盖），并 SHALL 支持在下次运行时按 `sessionId` 从 `ConversationStore` 恢复历史注入上下文窗口。

`sessionId` SHALL 可由宿主通过运行选项传入，使「刷新页面后续接同一会话」成为可能。

#### Scenario: 复用 sessionId 续接

- **WHEN** 以同一 `sessionId` 连续发起两次运行
- **THEN** 两次的消息归入同一会话，读取时按时间顺序完整返回

#### Scenario: 未提供 sessionId 时自动生成

- **WHEN** 运行未指定 `sessionId`
- **THEN** 自动生成 uuid 并在运行结果中返回该 id

#### Scenario: 历史恢复注入上下文

- **WHEN** 新一次运行开始时指定已存在的 `sessionId`
- **THEN** 已持久化的历史消息被载入上下文窗口（受窗口裁剪规则约束）

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

### Requirement: 长期记忆后端 MemoryBackend

系统 SHALL 定义 `MemoryBackend` 接口（长期记忆 KV 持久化）：`name`、`get(key)`、`set(key, value)`、`delete(key)`、`keys(prefix?)`、`clear()`；并提供 `InMemoryMemoryBackend`（`Map` 实现，`name` 为 `in-memory`）作为开发默认。后端经 `PluginContext.registerMemoryBackend` 注入，按 `memory.longTerm.backend`（默认 `in-memory`）名字解析——内置 `in-memory` 与插件注册的后端按名查找，未注册名字抛可读错误；解析出的后端随 `ResolvedAgent.memoryBackend` 暴露。

#### Scenario: in-memory 默认读写

- **WHEN** 以 `InMemoryMemoryBackend` 执行 `set` 后 `get`
- **THEN** 返回写入值；`delete` 后 `get` 返回 `undefined`；`keys` 反映剩余 key

#### Scenario: 配置按名解析

- **WHEN** `memory.longTerm.backend` 未声明（默认 `in-memory`）
- **THEN** 解析出的 `ResolvedAgent.memoryBackend.name` 为 `in-memory`

#### Scenario: 插件注册自定义后端

- **WHEN** 一个 plugin 经 `registerMemoryBackend` 注册名为 `pgvector` 的后端，且配置 `memory.longTerm.backend: pgvector`
- **THEN** 解析出的后端为插件注册的实例

#### Scenario: 未注册名报错

- **WHEN** `memory.longTerm.backend` 指向未注册名字
- **THEN** 装配期抛可读错误，不静默回退

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

### Requirement: 语义召回长期记忆（LongTermMemory / SemanticMemory）

系统 SHALL 定义 `LongTermMemory` 接口（`name` + `remember(text)` / `recall(query, topK?)` → 召回文本数组）与 `noopLongTermMemory` 默认（`remember` 空、`recall` 返回空数组）。语义实现（`SemanticMemory`）SHALL 已外放为 `@lhx-agent-engine/plugin-memory`，由组合层注入；`assemble` SHALL 以「注入的 `longTermMemory` 或 no-op 默认」装配，core 不再持有语义实现。

#### Scenario: 无注入时 no-op 默认

- **WHEN** `assemble` 未注入 `longTermMemory` 时 run
- **THEN** `recall` 返回空、`remember` 不写，不抛错

#### Scenario: 注入实现时走协议

- **WHEN** 注入一个自定义 `LongTermMemory` 实现后 run
- **THEN** `AgentLoop` 按协议 `recall` 注入 system prompt、正常结束 `remember` 写回
