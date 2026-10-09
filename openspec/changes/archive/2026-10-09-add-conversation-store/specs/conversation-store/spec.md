## ADDED Requirements

### Requirement: ConversationStore 可插拔后端协议

系统 SHALL 定义 `ConversationStore` 协议作为对话历史的持久化后端，至少包含：`createSession`（建会话）、`appendMessage`（追加消息）、`listMessages`（按会话读取）、`listSessions`（列举会话）、`deleteSession`（删除会话及消息）。该协议 SHALL 与 `MemoryBackend` / `CacheBackend` / `VectorStore` 同构，通过 `PluginContext.registerConversationStore()` 注入，经 `CapabilityBundle` 汇聚，并在 `ResolvedAgent.conversationStore` 暴露。

系统 SHALL 提供 `InMemoryConversationStore` 作为默认实现；`config.session.store` 缺省值 SHALL 为 `in-memory`。

#### Scenario: 默认零配置可用

- **WHEN** 配置未声明 `session.store`
- **THEN** 使用 `InMemoryConversationStore`，行为与变更前一致（进程内保存，重启丢失）

#### Scenario: 按名切换后端

- **WHEN** 配置声明 `session.store: pg` 且已注册名为 `pg` 的实现
- **THEN** 对话历史写入 pg，进程重启后仍可读取

### Requirement: 会话与消息模型

会话记录 SHALL 至少包含 `id`（uuid）、`agentName`、`userId`、`title`、`status`、`messageCount`、`createdAt`、`updatedAt`；消息记录 SHALL 至少包含 `id`、`sessionId`、`seq`（会话内单调序号）、`role`（user / assistant / tool / system）、`content`、`toolCalls`、`toolCallId`、`name`、`tokens`、`createdAt`。

同一会话内 `(sessionId, seq)` SHALL 唯一；`seq` SHALL 单调递增，读取时按 `seq` 升序返回。

#### Scenario: 顺序保证

- **WHEN** 连续追加三条消息后读取
- **THEN** 返回顺序与写入顺序一致，seq 为递增

#### Scenario: 重复 seq 被拒

- **WHEN** 以已存在的 `(sessionId, seq)` 再次写入
- **THEN** 写入失败并显式报错，不得覆盖已有消息

### Requirement: 运行期全路径落盘

`AgentLoop` 在会话结束时 SHALL 将本轮产生的消息写入 `ConversationStore`，**覆盖正常返回、抛出异常、外部中断三条出口**；中断时 SHALL 写入已产生的部分消息。

写盘失败 SHALL 按 best-effort 处理：记录告警事件并标记该次运行未持久化，但不得改变对话结果的正常返回。

#### Scenario: 中断仍保留已产生内容

- **WHEN** 运行中途被 Abort 中断
- **THEN** 已产生的 user 消息与部分 assistant / tool 消息仍被写入并可被读取

#### Scenario: 存储故障不阻断对话

- **WHEN** `ConversationStore.appendMessage` 抛错
- **THEN** 运行正常返回结果，并发出一次持久化失败事件

### Requirement: 结束会话不清除历史

`endSession()` SHALL 只清理进程内的上下文窗口，**不得**删除已持久化的会话与消息；会话状态 SHALL 标记为结束但消息保留。

#### Scenario: 结束会话后仍可读历史

- **WHEN** 调用 `endSession()` 后按 sessionId 读取消息
- **THEN** 历史消息完整返回

### Requirement: 历史读取支持分页与限量

`listMessages` SHALL 支持 `limit` 与 `beforeSeq` 参数，使调用方可只取「最近 N 条」或按游标向前翻页，避免全量回放撑爆上下文。

#### Scenario: 只取最近 N 条

- **WHEN** 会话有 100 条消息，调用 `listMessages(sessionId, { limit: 20 })`
- **THEN** 返回 seq 最大的 20 条，按 seq 升序
