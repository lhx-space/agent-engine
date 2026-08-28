## MODIFIED Requirements

### Requirement: createPresetPluginFactories 聚合全部插件

系统 SHALL 提供 `@lhx-agent-engine/preset-default` 包，导出 `createPresetPluginFactories(config)`，返回 `Record<string, PluginFactory>`，覆盖 files / bash / git（安全工具）、rules / skills / documents / guardrails / web / mcp（能力）与 otel（可观测，opt-in 经 `config.plugins`）。

#### Scenario: 工厂齐全

- **WHEN** 以缺省 config 调用 `createPresetPluginFactories`
- **THEN** 返回十个插件名的工厂（files / bash / git / rules / skills / documents / guardrails / web / mcp / otel）
