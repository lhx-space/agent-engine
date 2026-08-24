## MODIFIED Requirements

### Requirement: plugin 工厂注册表

系统 SHALL 通过 `deps.pluginFactories`（`name → () => Plugin | Promise<Plugin>`）解析 `config.plugins` 的字符串名；缺失的插件名 SHALL 报包含该名的可读错误。内置 files / bash / git 的工厂由装配层（server）注入 `deps.pluginFactories`，core 不再内置插件工厂表。

#### Scenario: 按名实例化 plugin

- **WHEN** `config.plugins` 含某名且 `deps.pluginFactories` 提供其工厂
- **THEN** 该 plugin 被实例化并安装，能力进入 registry

#### Scenario: 缺失工厂报错

- **WHEN** `config.plugins` 含某名但 `deps.pluginFactories` 未提供
- **THEN** 抛出包含该插件名的错误
