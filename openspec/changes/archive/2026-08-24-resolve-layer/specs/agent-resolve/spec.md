## ADDED Requirements

### Requirement: 能力束统一（CapabilityBundle）

系统 SHALL 定义 `CapabilityBundle`（`tools` / `skills` / `hooks` / `rules` / `promptFragments` / 可选 `dispose`）；plugin / mcp / builtin / config 各能力来源 SHALL 统一产出 bundle，经单一 `mergeBundles` 汇聚进 AgentLoop 的 sinks。

#### Scenario: 各来源产出 bundle

- **WHEN** 分别安装 plugin、连接 mcp、装配 builtin
- **THEN** 三者都产出 `CapabilityBundle`（形状一致），可合并

#### Scenario: dispose 随 bundle 携带

- **WHEN** MCP 连接产出的 bundle 含 `dispose`
- **THEN** 该 `dispose` 关闭对应连接，由上层聚合统一调用

### Requirement: mergeBundles 汇聚

系统 SHALL 提供 `mergeBundles(bundles)`，把多个 bundle 合并为 AgentLoop 所需 sinks（registry / hooks / rules / skills / promptFragments）与聚合后的 `dispose`。

#### Scenario: 合并多个 bundle

- **WHEN** 合并 plugin + mcp + builtin 三个 bundle
- **THEN** 工具全部注册进 registry、hooks 全注册、rules/skills 全合并、dispose 聚合了所有子 dispose

### Requirement: 配置一键装配（resolveAgentConfig）

系统 SHALL 提供 `resolveAgentConfig(config, deps?)`，读全量 `AgentConfig`，装配 provider / tools / skills / plugins / mcp / rules / systemPrompt / memory / security，返回 `ResolvedAgent`（`agent` + `dispose`）。

#### Scenario: 完整配置装配

- **WHEN** 传入含 model / systemPrompt / rules / tools / skills / plugins / mcp / memory / security 的 `AgentConfig`
- **THEN** 返回可 `run()` 的 `AgentLoop`，各轴按配置生效

#### Scenario: dispose 聚合关闭

- **WHEN** 调用 `ResolvedAgent.dispose()`
- **THEN** 所有 MCP 连接等 bundle 资源被关闭

### Requirement: plugin 工厂注册表

系统 SHALL 通过 `deps.pluginFactories`（`name → () => Plugin | Promise<Plugin>`）解析 `config.plugins` 的字符串名；缺失的插件名 SHALL 报包含该名的可读错误。

#### Scenario: 按名实例化

- **WHEN** `config.plugins` 含 `@lhx-agent-engine/plugin-git` 且 `deps.pluginFactories` 提供其工厂
- **THEN** 该 plugin 被实例化并安装，能力进入 registry

#### Scenario: 缺失工厂报错

- **WHEN** `config.plugins` 含某名但 `deps.pluginFactories` 未提供
- **THEN** 抛出包含该插件名的错误
