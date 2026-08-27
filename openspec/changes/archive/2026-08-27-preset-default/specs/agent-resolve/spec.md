## MODIFIED Requirements

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
