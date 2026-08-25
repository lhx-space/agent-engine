# session-memory Specification

## Purpose

TBD - created by archiving change add-session-memory. Update Purpose after archive.

## Requirements

### Requirement: 会话历史管理

系统 SHALL 提供 `ConversationMemory`，保存会话消息历史（user / assistant / tool），支持 `push` / `append` 追加、`getMessages` 读取（返回副本）、`size` 计数、`clear` 清空。

#### Scenario: 追加与读取

- **WHEN** 依次 push / append 若干消息
- **THEN** `getMessages` 按追加顺序返回全部消息，`size` 等于条数

#### Scenario: 清空

- **WHEN** 调用 `clear`
- **THEN** 历史清空，`size` 为 0

#### Scenario: 读取返回副本

- **WHEN** 修改 `getMessages` 返回的数组
- **THEN** 不影响内部历史

### Requirement: 窗口裁剪

系统 SHALL 支持 `maxMessages` 限制；历史条数超过 `maxMessages` 时，按「整轮边界」从头部淘汰（裁剪点对齐到 `user` 消息起点），保证不拆散 assistant `tool_call` 与其后的 `tool` 结果配对；未设置或非正数时不裁剪。

#### Scenario: 超限按整轮边界淘汰

- **WHEN** `maxMessages=3` 且历史为两轮 `[u1, a1, u2, a2]`
- **THEN** 从头部淘汰到最近轮次起点，保留 `[u2, a2]`

#### Scenario: 不拆散 tool_call 配对

- **WHEN** 裁剪点落在 assistant（含 tool_calls）与其 tool 结果之间
- **THEN** 裁剪点后移对齐到下一个 `user` 起点，整组一起保留或一起淘汰，不产生孤立 tool 消息

#### Scenario: 未设置不裁剪

- **WHEN** 未设置 `maxMessages`
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
