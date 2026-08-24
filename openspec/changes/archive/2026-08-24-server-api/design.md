## Context

给「配置即 Agent」开一条 HTTP 通道：WebApp 与外部系统通过 HTTP 调用已装配的 Agent。复用 core 的 `resolveAgentConfig` 与 config 的 Schema/安全原语，server 只做「HTTP 编解码 + 生命周期」。

## Goals / Non-Goals

**Goals:**

- `createApp(options)` 返回 Hono 实例，含 `GET /health`、`POST /api/agent/run`。
- run 端点：校验 config → resolve → run → 返回 `AgentLoopResult`，`finally` dispose。
- 错误处理：非法 JSON/config → 400；resolve/run 失败 → 500。
- `serve(options, port)` 启动监听。

**Non-Goals:**

- 不做流式（留 `llm-streaming`）。
- 不做 session / agent 实例缓存（每次请求内联 resolve+run+dispose，无状态）。
- 不做鉴权 / 限流 / CORS 细节（M4 后续）。
- 不在 server 硬编码具体 plugin 工厂（经 `options.pluginFactories` 注入）。

## Decisions

### D1: 复用 Hono（库照用，不引重框架）

**选择**：`hono`（已在 `packages/server` 依赖中）+ `@hono/node-server` 适配器。

**理由**：web-standard（Request/Response）、轻量、天然支持流式（后续）；符合「库照用，框架不引入」。测试用 `app.request()` 免真监听。

### D2: `createApp` 返回 Hono 实例，`serve` 单独拆

**选择**：`createApp(options)` 纯构造（可测）；`serve(options, port)` 用 `@hono/node-server` 监听。

**理由**：应用构造与进程启动分离；测试只测 app，不测进程。

### D3: run 端点内联 resolve+run+dispose（无状态）

**选择**：每次请求 `resolveAgentConfig` → `run` → `finally dispose`，不缓存 agent 实例。

**理由**：首版无 session 概念；内联保证 MCP 连接等资源用完即关。缓存留后续（引入 agent registry + 生命周期管理）。

### D4: 配置校验复用 config 原语

**选择**：body.config 经 `sanitizeConfigValue` → `AgentConfigSchema.safeParse` → `deepFreeze`，与 `loadAgentConfig` 一致。

**理由**：单一事实来源；HTTP body 与文件加载走同一套安全防线，不另写校验。

### D5: 错误统一 `{ error, details }`

**选择**：400 返回非法 JSON/config；500 返回 resolve/run 失败；结构统一 `{ error, details }`。

**理由**：前端（TanStack Query）可统一处理错误分支。

## Risks / Trade-offs

- [无鉴权] → 首版内网/本地使用；鉴权在 M4 后续（token/mTLS）。
- [每次请求重解析 config + 重连 MCP] → 首版可接受；高频场景留 agent 缓存后续。
- [config 体积随 body 上传] → 首版 WebApp 本地调用，可接受；后续可改为「server 端 config 注册表 + id 引用」。

## Migration Plan

`@agent-engine/server` 现为 stub（name/version），直接替换为 `createApp`/`serve` 实现，无迁移。
