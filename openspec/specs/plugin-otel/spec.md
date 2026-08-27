# plugin-otel Specification

## Purpose

TBD - created by archiving change 2026-08-28-implement-otel-plugin. Update Purpose after archive.

## Requirements

### Requirement: createOtelPlugin

系统 SHALL 提供 `@agent-engine/plugin-otel` 的 `createOtelPlugin(options?)`，返回一个 `Plugin`；`install(ctx)` SHALL 经 `ctx.registerHook` 注入一个覆盖 10 个生命周期点的 hook，每个点用 `@opentelemetry/api` 的 `startActiveSpan` 创建 span、设置 `agent.*` 属性；`onError` 与 hook 方法异常 SHALL `recordException` 并置 `status=ERROR`。hook SHALL 不改写任何入参（返回 void）。

#### Scenario: install 注册 hook

- **WHEN** 调用 `createOtelPlugin()` 的 `install(ctx)`
- **THEN** `ctx.registerHook` 被调用一次，注入的 hook 名含 `plugin-otel`

#### Scenario: 无 tracer provider 安全 no-op

- **WHEN** 未设置全局 OTel tracer provider 时调用 hook 的 `beforeLLM` / `afterLLM` / `beforeToolCall` / `afterToolCall` / `onStepEnd` / `onError`
- **THEN** 各方法正常返回（NOOP tracer），不抛错

#### Scenario: 异常记录

- **WHEN** `onError` 被调用
- **THEN** span 记录异常并置 `status=ERROR`
