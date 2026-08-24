## ADDED Requirements

### Requirement: HTTP API 应用

系统 SHALL 提供 `createApp(options)`，返回一个 Hono 实例，含 `GET /health` 与 `POST /api/agent/run` 两个端点；`options` 可注入 `pluginFactories`（name → 工厂）与 `providerFactory`。

#### Scenario: 创建应用

- **WHEN** 调用 `createApp()`（不传 options）
- **THEN** 返回可用的 Hono 实例，`GET /health` 返回 `{ ok: true }`

### Requirement: run 端点装配执行

`POST /api/agent/run` SHALL 接收 `{ config: AgentConfig, input: string }`：对 config 做 `sanitizeConfigValue` → `AgentConfigSchema` 校验 → `deepFreeze`，再经 `resolveAgentConfig` 装配，调用 `agent.run(input)` 返回 `AgentLoopResult`，并在 `finally` 中 `dispose()`。

#### Scenario: 合法请求返回结果

- **WHEN** 传入合法 config 与 input
- **THEN** 返回 200 与 `AgentLoopResult`（含 finalMessage / messages / steps）

#### Scenario: dispose 生命周期

- **WHEN** run 完成或抛错
- **THEN** 装配产生的资源（MCP 连接等）被 `dispose()` 关闭

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
