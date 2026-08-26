# @agent-engine/server

Agent Engine HTTP 服务（Docker 部署）。基于 Hono 对外提供 REST + 流式 API，调用 `@agent-engine/core`。

## 安装

```bash
pnpm add @agent-engine/server
```

## 端点

| 方法     | 路径                      | 说明                                                                     |
| -------- | ------------------------- | ------------------------------------------------------------------------ |
| `GET`    | `/health`                 | 存活探针 → `{ ok: true }`                                                |
| `POST`   | `/api/agent/run`          | 非流式运行：`{ config, input, sessionId? }` → `{ sessionId, ...result }` |
| `POST`   | `/api/agent/run/stream`   | NDJSON 流式运行（`application/x-ndjson`），响应头 `x-session-id`         |
| `DELETE` | `/api/agent/sessions/:id` | 结束并释放会话 → `{ ok: true }`                                          |

## 用法

```ts
import { createApp, serve } from '@agent-engine/server';
import { pino } from 'pino'; // 可选

const app = createApp({
  // 若不用内置插件，可在此注入 pluginFactories / providerFactory
  sessionStore: mySessionStore, // SessionStoreBackend（默认 InMemorySessionStore）
  logger: pino(), // Logger（默认 consoleLogger）
});

serve({/* ServerOptions */}, 8080);
```

## 可插拔

- **`SessionStoreBackend`** —— 会话生命周期（复用 / TTL / LRU 淘汰）。默认 `InMemorySessionStore`；redis 等实现同接口即可。
- **`Logger`** —— info/warn/error/debug。默认 `consoleLogger`；pino / winston / OTel 经 `options.logger` 注入（日志不是内核关注点——可观测真相源在 events 总线 + hooks）。

## 说明

- `createBuiltinPluginFactories(config)` 无需外部工厂即可装配 `@agent-engine/plugin-files` / `plugin-bash` / `plugin-git`。
- `envProviderFactory` 从环境变量解析 LLM provider（默认 DeepSeek）。

## 状态

✅ 已实现（REST + 流式 + 会话生命周期 + 可插拔 store/logger）。
