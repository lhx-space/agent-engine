# @lhx-agent-engine/plugin-otel

OpenTelemetry 可观测插件——经 `PluginContext.registerHook` 把 Agent 执行链路接入 OpenTelemetry traces。

## 用法

```ts
import { createOtelPlugin } from '@lhx-agent-engine/plugin-otel';

const plugin = createOtelPlugin({ tracerName: '@lhx-agent-engine/plugin-otel' });
// 经 config.plugins 激活（或注入 pluginFactories）
```

10 个生命周期 hook 点各映射为一个 span：`agent.init`、`agent.llm`、`agent.tool`、`agent.step`、`agent.session.*`、`agent.context.compose`、`agent.error`。异常经 `recordException` + `status=ERROR` 记录；hook 从不改写任何值（纯观察）。

只依赖 `@opentelemetry/api`——exporter / 采样经 OTel SDK 配置（如 `@opentelemetry/sdk-node`）；未设 tracer provider 时插件为安全 no-op。

## 状态

✅ 已实现（仅 traces；metrics / logs 延后）。
