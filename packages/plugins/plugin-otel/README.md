# @agent-engine/plugin-otel

OpenTelemetry observability plugin.

## Plan

- Inject hooks via `PluginContext.registerHook` to wire the Agent execution path into OpenTelemetry (trace / span / metrics).
- Pair with the locally available `prometheus` + `grafana` images for observability.

## Status

📦 Scaffold (to be implemented in M5).
