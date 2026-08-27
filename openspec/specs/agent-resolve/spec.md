# agent-resolve Specification

## Purpose

TBD - created by archiving change resolve-layer. Update Purpose after archive.

## Requirements

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

系统 SHALL 通过 `deps.pluginFactories`（`name → () => Plugin | Promise<Plugin>`）解析 `config.plugins` 的字符串名，并与 `deps.defaultPlugins`（组合层按 config 切片激活的额外插件名）去重合并后按名实例化；缺失的插件名 SHALL 报包含该名的可读错误。插件工厂表由组合层（`@agent-engine/preset-default` / server）注入，core 不硬编码能力映射。

#### Scenario: 按名实例化 plugin

- **WHEN** `config.plugins` 含某名且 `deps.pluginFactories` 提供其工厂
- **THEN** 该 plugin 被实例化并安装，能力进入 registry

#### Scenario: defaultPlugins 去重合并

- **WHEN** `deps.defaultPlugins` 含某能力插件名（如 `plugin-web`）且 `config.plugins` 未显式声明
- **THEN** 该插件仍被实例化（不因未在 `config.plugins` 而缺失）

#### Scenario: 缺失工厂报错

- **WHEN** 某名（来自 `config.plugins` 或 `defaultPlugins`）但 `deps.pluginFactories` 未提供
- **THEN** 抛出包含该插件名的错误

### Requirement: onInit 触发

`resolveAgentConfig` SHALL 在装配完成、返回 `ResolvedAgent` 前触发 `onInit`（若注册了该 hook）；`onInit` 抛错 SHALL 使 resolve 失败并抛出（同其他装配错误）。

#### Scenario: 装配完成触发 onInit

- **WHEN** 注入含 `onInit` 的 hook 并调用 `resolveAgentConfig`
- **THEN** 装配完成后 `onInit` 触发一次

#### Scenario: onInit 抛错使 resolve 失败

- **WHEN** `onInit` 抛错
- **THEN** `resolveAgentConfig` 抛出该错误，返回前释放已装配资源

#### Scenario: 未注册 onInit 不报错

- **WHEN** 未注入含 `onInit` 的 hook
- **THEN** resolve 正常完成，无副作用

### Requirement: guardrail 装配

`resolveAgentConfig` SHALL 在装配时把「插件注册的 guardrail（`merged.guardrails`）」与「`config.guardrails` 编译出的声明式 guardrail」合并进同一 `RuleRegistry`，注入 `AgentLoop`，使声明式安全拦截在工具执行前/后生效；无任何 guardrail 时循环仍正常运行。

#### Scenario: 声明式 guardrail 生效

- **WHEN** 配置声明 `guardrails: [{ id: 'deny-bash', denyTools: ['builtin.bash'] }]` 并经 `resolveAgentConfig` 装配
- **THEN** 模型调用 `builtin.bash` 时被阻断，工具结果回填 `Blocked: ...`

#### Scenario: 插件与声明式并存

- **WHEN** 插件经 `registerGuardrail` 注册一条规则、配置又声明一条
- **THEN** 两条规则都在 `RuleRegistry` 中，各自按 `on` 节点生效
