# server-api Specification

## Purpose

TBD - created by archiving change server-api. Update Purpose after archive.

## Requirements

### Requirement: HTTP API 应用

系统 SHALL 提供 `createApp(options)`，返回一个 Hono 实例，含 `GET /health` 与 `POST /api/agent/run` 两个端点；`options` 可注入 `pluginFactories`（name → 工厂）与 `providerFactory`。

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

server SHALL 使用 pino 记录每次运行的关键事件（启动、step、tool 调用、错误），替代散落的 console 输出。

#### Scenario: 运行打日志

- **WHEN** 一次运行产生事件
- **THEN** 对应事件以结构化日志输出

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

### Requirement: 内置 plugin 工厂注入

server SHALL 提供 `createBuiltinPluginFactories(config)`，为 `@agent-engine/plugin-files` / `@agent-engine/plugin-bash` / `@agent-engine/plugin-git` 构造工厂（闭包捕获 `security`，bash/git 的沙箱惰性解析）；`resolveAgentConfig` 调用时 SHALL 合并这些内置工厂与 `options.pluginFactories`。

#### Scenario: 内置 plugin 按声明加载

- **WHEN** 请求 config 的 `plugins` 含 `@agent-engine/plugin-files`
- **THEN** server 注入其工厂，`read_file` / `write_file` 进入 registry（无需外部 pluginFactories）

#### Scenario: 用户工厂覆盖内置

- **WHEN** `options.pluginFactories` 提供同名工厂
- **THEN** 用户工厂优先（内置工厂被覆盖）
