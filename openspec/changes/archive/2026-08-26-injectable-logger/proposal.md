## Why

pino 是 server 的硬依赖，且 `core` 也冗余声明了 pino（`core/src` 从未使用）。日志不是内核/服务的必备能力——可观测的「真相源」已在 `events` 总线 + hooks（AOP），日志策略应由用户按需经 AOP/注入接入，而非内置锁定。本 change 把 pino 降级为「可插拔 Logger」，默认 console。

## What Changes

- `core`：移除未使用的 `pino` 依赖。
- `server/src/logger.ts`：`Logger` 接口（info / warn / error / debug）+ `consoleLogger` 默认（console 输出），移除 pino。
- `ServerOptions.logger`：注入点，任意 Logger（pino / winston / OTel）经 options 接入。
- `server/src/{app,index,types}.ts`：装配层走注入的 logger（缺省 `consoleLogger`）。
- `server`：移除 `pino` 依赖。

## Capabilities

### New Capabilities

<!-- 无新增能力目录。 -->

### Modified Capabilities

- `server-api`: 「结构化日志」需求由「内置 pino」改为「`Logger` 接口 + `consoleLogger` 默认 + `options.logger` 注入点」。

## Impact

- 修改 `packages/server/src/{logger.ts,app.ts,types.ts,index.ts}`、`packages/core/package.json`、`packages/server/package.json`、`pnpm-lock.yaml`。
- 测试：注入自定义 Logger 断言被调用。
- **破坏性（小）**：移除 `@agent-engine/server` 的 `logger`（pino 实例）导出，改为 `consoleLogger` + `Logger`；不再内置 pino，需结构化 JSON 日志者自行 `createApp({ logger: pino() })`。
