# @agent-engine/plugin-otel

OpenTelemetry observability plugin — wires the Agent execution path into OpenTelemetry traces via `PluginContext.registerHook`.

## Usage

```ts
import { createOtelPlugin } from '@agent-engine/plugin-otel';

const plugin = createOtelPlugin({ tracerName: '@agent-engine/plugin-otel' });
// activate via config.plugins (or inject into pluginFactories)
```

Each of the 10 lifecycle hook points becomes a span: `agent.init`, `agent.llm`, `agent.tool`, `agent.step`, `agent.session.*`, `agent.context.compose`, `agent.error`. Errors are recorded via `recordException` + `status=ERROR`; the hook never rewrites any value (pure observer).

Only `@opentelemetry/api` is used — configure your exporter / sampling through the OTel SDK (e.g. `@opentelemetry/sdk-node`); without a tracer provider the plugin is a safe no-op.

## Status

✅ Implemented (traces only; metrics / logs deferred).
