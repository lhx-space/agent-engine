## Why

`@lhx-agent-engine/plugin-otel` 是能力外放后**唯一仍为「📦 scaffold」**的能力插件（只有 name/version 导出），也是「可观测」这个横切关注点的最后一块。落地它既能补齐可观测能力，又能验证 `PluginContext.registerHook` 注入点在能力外放后是否足够——「协议化是否彻底」的试金石。

## What Changes

- **`@lhx-agent-engine/plugin-otel` 落地**：新增 `createOtelPlugin(options?)`，经 `ctx.registerHook` 注入一个覆盖 10 个生命周期点的 hook，每个点用 OTel `startActiveSpan` 创建 span + 设置 `agent.*` 属性 + 异常时 `recordException` / `status=ERROR`。
- 依赖：复用已声明的 `@opentelemetry/api`（不绑定 exporter，导出器由用户经 SDK 配置）。
- **core 注释清理**：`plugins/types.ts` 与 `resolve/types.ts` 里 `registerRetriever` / `retriever` 的「缺省 BM25」注释改为实际默认 `noopRetriever`（`'none'`）。

## Capabilities

### Added Capabilities

- `plugin-otel`: `createOtelPlugin` 把 Agent 执行链路接入 OpenTelemetry。

## Impact

- 修改 `packages/plugins/plugin-otel/src/index.ts`（落地）、`tests/otel.test.ts`（新增）、`README*.md`（状态更新）。
- 修改 `packages/core/src/plugins/types.ts`、`packages/core/src/resolve/types.ts`（注释）。
- 兼容性：otel 插件 API 为新增，不影响既有装配。
