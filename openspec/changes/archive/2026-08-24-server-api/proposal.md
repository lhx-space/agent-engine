## Why

「配置即 Agent」已经在 core 层闭合（`loadAgentConfig` → `resolveAgentConfig` → `AgentLoop.run`），但还没有一条对外 HTTP 通道——单 Agent 只能被编程式调用，无法被 WebApp 或外部系统消费。这是「单 Agent 在实际应用中校验」的前置：先有后端 API，WebApp 才有地方调。

## What Changes

- 新增 `@agent-engine/server` 的 HTTP API（复用 `hono`，已在依赖中）：
  - `createApp(options)` 返回 Hono 实例，含 `GET /health` 与 `POST /api/agent/run`。
  - `POST /api/agent/run`：body `{ config: AgentConfig, input: string }` → 校验 config → `resolveAgentConfig` → `agent.run(input)` → 返回 `AgentLoopResult`；`finally` 里 `dispose()`。
  - `serve(options, port)` 用 `@hono/node-server` 启动监听。
- 复用 core 的 `resolveAgentConfig` 与 config 的 `AgentConfigSchema` / `sanitizeConfigValue` / `deepFreeze`（单一事实来源，不重写装配与校验）。

## Capabilities

### New Capabilities

- `server-api`: Hono 应用工厂、`/api/agent/run` 端点、错误处理、`serve` 启动。

## Impact

- 修改 `packages/server/src/`（`types.ts` / `app.ts` / `serve.ts` / `index.ts`）。
- 新增依赖 `@hono/node-server`（Hono 的 Node 适配器，启动监听用）。
- 新增 `packages/server/tests/server.test.ts`（用 `app.request()` 免真监听测试）。
- 无 breaking changes：`@agent-engine/server` 当前是占位 stub，直接替换。
- 首版范围：非流式（流式留 `llm-streaming`）；无 session/agent 实例缓存（每次请求内联 resolve+run+dispose）。
