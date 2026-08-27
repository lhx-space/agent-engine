# server-api Specification

## Purpose

TBD - created by archiving change server-api. Update Purpose after archive.

## Requirements

### Requirement: HTTP API 应用

系统 SHALL 提供 `createApp(options)`，返回一个 Hono 实例，含 `GET /health`、`POST /api/agent/run`、`POST /api/agent/run/stream`、`DELETE /api/agent/sessions/:id` 与 skill 发现端点（`GET /api/skills/discover` / `GET /api/skills` / `POST /api/skills/install`）；`options` 可注入 `pluginFactories`、`providerFactory`、`sessionStore`、`logger` 与 `skillDiscoverer`。

#### Scenario: 创建应用

- **WHEN** 调用 `createApp()`（不传 options）
- **THEN** 返回可用的 Hono 实例，`GET /health` 返回 `{ ok: true }`

### Requirement: run 端点装配执行

`POST /api/agent/run` SHALL 接收 `{ config: AgentConfig, input: string, sessionId?: string }`：对 config 做 `sanitizeConfigValue` → `AgentConfigSchema` 校验 → `deepFreeze`；当 `sessionId` 存在且命中 SessionStore 时 SHALL 复用已装配 Agent（含 memory）直接 `run`，否则经 `resolveAgentConfig` 新建并写入 SessionStore；响应 SHALL 返回 `sessionId` 与 `AgentLoopResult`。

#### Scenario: 合法请求返回结果与 sessionId

- **WHEN** 传入合法 config 与 input（无 sessionId）
- **THEN** 返回 200 与 `{ sessionId, finalMessage, messages, steps }`，session 已入 store

#### Scenario: 复用已有 session

- **WHEN** 传入已存在的 sessionId
- **THEN** 复用同一 AgentLoop 与 memory（历史累积），不重新装配

### Requirement: 错误处理

系统 SHALL 对非法 JSON / 非法 config 返回 400，对 resolve / run 失败返回 500；错误响应统一为 `{ error, details }`。

#### Scenario: 非法 config 返回 400

- **WHEN** config 缺少必填字段或格式非法
- **THEN** 返回 400 与 `{ error: 'invalid config', details }`

#### Scenario: 装配或运行失败返回 500

- **WHEN** `resolveAgentConfig` 抛错（如 plugin 名缺失）或 `run` 抛错
- **THEN** 返回 500 与 `{ error, details }`

### Requirement: 服务启动

系统 SHALL 提供 `serve(options, port)`，用 `@hono/node-server` 启动 HTTP 监听。

#### Scenario: 启动监听

- **WHEN** 调用 `serve(options, 8080)`
- **THEN** 服务器在 8080 端口监听 `createApp(options)` 的 fetch 处理器

### Requirement: NDJSON 流式端点

系统 SHALL 提供 `POST /api/agent/run/stream`：接收 `{ config, input }`，以 NDJSON（`application/x-ndjson`）逐行推送运行时事件。

#### Scenario: 流式返回事件

- **WHEN** 发起流式运行请求
- **THEN** 响应为 NDJSON，每行一个 JSON 事件，最终包含 `done` 事件

#### Scenario: 错误事件

- **WHEN** 运行失败
- **THEN** 流中包含 `error` 事件，含错误信息

### Requirement: 结构化日志

server SHALL 提供 `Logger` 接口（`info` / `warn` / `error` / `debug`，均接收 `(obj, msg?)`）与 `consoleLogger` 默认实现（console 输出）；`createApp` 的 `options.logger` SHALL 接受任意 `Logger` 实现（缺省 `consoleLogger`），使 pino / winston / OTel 等日志后端经 options 或插件（AOP）接入，不内置锁定。运行时错误与流式事件 SHALL 经注入的 logger 输出。

#### Scenario: 默认 console 日志

- **WHEN** 不注入 `options.logger`
- **THEN** 使用 `consoleLogger`（console 输出），不依赖 pino

#### Scenario: 注入自定义 logger

- **WHEN** `createApp({ logger: 自定义 Logger })`
- **THEN** 运行时错误/事件走该 logger（如 pino 实例）

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

### Requirement: skill 发现端点

系统 SHALL 提供 `GET /api/skills/discover?repo=<owner/repo>`（列出 skills.sh 某仓库的 skills）、`GET /api/skills`（列出已装 skills）与 `POST /api/skills/install`（`{ repo, skill }` 安装并返回本地路径）；`options.skillDiscoverer` SHALL 可注入 `SkillDiscoverer`（缺省 `createNpxSkillDiscoverer()`，经 `npx skills` 对接 skills.sh）。

#### Scenario: 发现 skill 列表

- **WHEN** `GET /api/skills/discover?repo=vercel-labs/agent-skills`
- **THEN** 返回 `{ repo, skills: [{ name, description }] }`

#### Scenario: 安装 skill

- **WHEN** `POST /api/skills/install` 传 `{ repo, skill }`
- **THEN** 返回 `{ path }`（本地安装路径）

#### Scenario: 缺参数返回 400

- **WHEN** discover 缺 `repo`，或 install 缺 `repo` / `skill`
- **THEN** 返回 400
