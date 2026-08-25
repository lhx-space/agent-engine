## MODIFIED Requirements

### Requirement: 会话复用与淘汰

系统 SHALL 提供 `SessionStoreBackend` 接口（`get(id)` / `set(id, session)` / `delete(id)` / `clear()`，均为异步），与 `InMemorySessionStore` 默认实现（以 `sessionId` 保存已装配 Agent，含 `dispose` / `lastActive`，空闲 TTL 默认 30 分钟、数量上限默认 1000 LRU 淘汰；淘汰触发 `endSession` + `dispose`）。`createApp` 的 `options.sessionStore` SHALL 接受任意 `SessionStoreBackend` 实现（缺省 `new InMemorySessionStore()`），使会话后端可插拔。系统 SHALL 提供 `DELETE /api/agent/sessions/:id` 显式结束会话（触发 `endSession` + `dispose`）。

#### Scenario: TTL 淘汰

- **WHEN** 某 session 超过空闲 TTL 未被访问
- **THEN** 该 session 被淘汰，触发 `onSessionEnd` 并释放资源

#### Scenario: 显式结束会话

- **WHEN** 调用 `DELETE /api/agent/sessions/:id`
- **THEN** 对应 session 结束并释放资源，返回 200

#### Scenario: 未知 session 复用回退新建

- **WHEN** 传入不存在的 sessionId
- **THEN** 按无 sessionId 处理：新建 session 并返回新 sessionId

#### Scenario: 注入自定义后端

- **WHEN** `createApp({ sessionStore: 自定义 SessionStoreBackend 实现 })`
- **THEN** 会话的保存/复用/删除走该后端（缺省则走 in-memory）
