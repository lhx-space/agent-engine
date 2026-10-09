## MODIFIED Requirements

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
