## ADDED Requirements

### Requirement: createPresetPluginFactories 聚合全部插件

系统 SHALL 提供 `@lhx-agent-engine/preset-default` 包，导出 `createPresetPluginFactories(config)`，返回 `Record<string, PluginFactory>`，覆盖 files / bash / git（安全工具）与 rules / skills / documents / guardrails / web / mcp（能力）。

#### Scenario: 工厂齐全

- **WHEN** 以缺省 config 调用 `createPresetPluginFactories`
- **THEN** 返回九个插件名的工厂（files / bash / git / rules / skills / documents / guardrails / web / mcp）

### Requirement: defaultCapabilityPlugins 按 config 切片激活

系统 SHALL 提供 `defaultCapabilityPlugins(config)`，返回需自动装配的能力插件名：rules / skills / documents / guardrails / mcp 按 config 切片非空激活，web 恒激活。

#### Scenario: 按切片激活

- **WHEN** `config.rules` 非空而 `config.skills` 为空
- **THEN** 返回含 `plugin-rules` 与 `plugin-web`，不含 `plugin-skills`

### Requirement: createPresetLongTermMemoryFactory 提供语义记忆

系统 SHALL 提供 `createPresetLongTermMemoryFactory()`，返回一个 `LongTermMemory` 工厂（用装配层解析出的 vectorStore / embedding / memoryBackend 创建 `plugin-memory` 的 `SemanticMemory`）。

#### Scenario: 创建 SemanticMemory

- **WHEN** 以 vectorStore / embedding / memoryBackend 调工厂
- **THEN** 返回 `name` 为 `semantic` 的 `LongTermMemory`
