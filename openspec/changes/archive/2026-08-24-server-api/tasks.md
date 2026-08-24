## 1. 类型与依赖

- [x] 1.1 `types.ts`：`ServerOptions`（pluginFactories / providerFactory）
- [x] 1.2 新增依赖 `@hono/node-server`

## 2. app 工厂

- [x] 2.1 `app.ts`：`createApp(options)` 返回 Hono 实例
- [x] 2.2 `GET /health` → `{ ok: true }`
- [x] 2.3 `POST /api/agent/run`：校验 config → resolveAgentConfig → run → 返回结果 → finally dispose

## 3. serve 启动

- [x] 3.1 `serve.ts`：`serve(options, port)` 用 `@hono/node-server` 监听

## 4. 导出

- [x] 4.1 `index.ts` 导出 `createApp` / `serve` / `ServerOptions`

## 5. 测试

- [x] 5.1 `server.test.ts`：`app.request()` 测 health / run 成功 / config 非法 400 / plugin 缺失 500
