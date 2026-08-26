## Context

server 当前硬依赖 pino（`logger.ts` + `app.ts` 直接 `logger.info/error`），且 `core` 也声明了未使用的 pino。日志不是内核/服务必备能力——可观测真相源是 `events` 总线 + hooks（AOP）。按「core 只做适配器」+「复用优先」，日志后端应可插拔，pino 由用户按需注入。

## Goals / Non-Goals

**Goals:**

- `Logger` 接口 + `consoleLogger` 默认 + `ServerOptions.logger` 注入点。
- 移除 core/server 的 pino 硬依赖。

**Non-Goals:**

- 不新建 pino 插件包——用户一行 `createApp({ logger: pino() })` 即可，无需插件。
- 不把 `Logger` 塞进 core——core 只产出事件（events 总线 + hooks），日志是部署/服务层关注点。

## Decisions

### D1: `Logger` 定在 server 层，不进 core

**选择**：`Logger` 接口 + `consoleLogger` 放 `server/src/logger.ts`；core 不依赖任何 logger。

**理由**：core 的可观测出口是 `EventBus` + hooks（AOP），已足够；日志格式/传输是部署层策略。避免 core 因日志再引入一个「框架级」关注点。

### D2: 默认 `consoleLogger`，pino 降为可选项

**选择**：默认用 `console.info/error/warn/debug`（保留 `(obj, msg?)` 双参形态）；pino 等结构化后端经 `options.logger` 注入。

**理由**：零依赖默认；`(obj, msg)` 签名与 pino/winston 兼容，用户替换无适配成本。核心「事件流」仍在 `events` 总线里，console 只是最低可用兜底。

### D3: 移除 `logger`（pino 单例）导出

**选择**：`index.ts` 不再导出 pino 单例 `logger`，改导出 `Logger` 类型 + `consoleLogger`。

**理由**：单例 pino 是把「实现」泄漏为 API；接口 + 默认 + 注入点才是「core 只做适配器」的形态。破坏面小（无外部消费方）。

## Risks / Trade-offs

- [默认 console 非结构化 JSON] → 需要结构化日志者注入 pino；这是可插拔的代价，符合「非必须不内置」。
- [移除 `logger` 导出破坏外部] → server 早期、无消费方；spec 同步更新。

## Migration Plan

- 外部 `import { logger } from '@agent-engine/server'` → `createApp({ logger: pino() })` 或直接用 `consoleLogger`。
- 无配置字段变化。
