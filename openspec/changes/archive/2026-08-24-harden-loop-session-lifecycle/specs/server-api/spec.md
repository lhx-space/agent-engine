## MODIFIED Requirements

### Requirement: run 端点装配执行

`POST /api/agent/run` SHALL 接收 `{ config: AgentConfig, input: string, sessionId?: string }`：对 config 做 `sanitizeConfigValue` → `AgentConfigSchema` 校验 → `deepFreeze`；当 `sessionId` 存在且命中 SessionStore 时 SHALL 复用已装配 Agent（含 memory）直接 `run`，否则经 `resolveAgentConfig` 新建并写入 SessionStore；响应 SHALL 返回 `sessionId` 与 `AgentLoopResult`。

#### Scenario: 合法请求返回结果与 sessionId

- **WHEN** 传入合法 config 与 input（无 sessionId）
- **THEN** 返回 200 与 `{ sessionId, finalMessage, messages, steps }`，session 已入 store

#### Scenario: 复用已有 session

- **WHEN** 传入已存在的 sessionId
- **THEN** 复用同一 AgentLoop 与 memory（历史累积），不重新装配

## ADDED Requirements

### Requirement: 会话复用与淘汰

系统 SHALL 提供 `SessionStore`：以 `sessionId` 保存已装配 Agent（含 `dispose` / `lastActive`），支持按空闲 TTL（默认 30 分钟）与数量上限（默认 1000，LRU）淘汰；淘汰 SHALL 触发 `endSession` 并 `dispose`。系统 SHALL 提供 `DELETE /api/agent/sessions/:id` 显式结束会话（触发 `endSession` + `dispose`）。

#### Scenario: TTL 淘汰

- **WHEN** 某 session 超过空闲 TTL 未被访问
- **THEN** 该 session 被淘汰，触发 `onSessionEnd` 并释放资源

#### Scenario: 显式结束会话

- **WHEN** 调用 `DELETE /api/agent/sessions/:id`
- **THEN** 对应 session 结束并释放资源，返回 200

#### Scenario: 未知 session 复用回退新建

- **WHEN** 传入不存在的 sessionId
- **THEN** 按无 sessionId 处理：新建 session 并返回新 sessionId
