## MODIFIED Requirements

### Requirement: plugin 工厂注册表

系统 SHALL 通过 `deps.pluginFactories`（`name → () => Plugin | Promise<Plugin>`）解析 `config.plugins` 的字符串名；缺失的插件名 SHALL 报包含该名的可读错误。系统 SHALL 额外内置一张「内置 plugin 工厂表」（`@agent-engine/plugin-files` / `@agent-engine/plugin-bash`），命中时用 core 内部工厂（带 `security` / `sandbox` 上下文）构造，无需 `deps.pluginFactories` 提供。

#### Scenario: 按名实例化外部 plugin

- **WHEN** `config.plugins` 含 `@agent-engine/plugin-git` 且 `deps.pluginFactories` 提供其工厂
- **THEN** 该 plugin 被实例化并安装，能力进入 registry

#### Scenario: 内置 plugin 按名构造

- **WHEN** `config.plugins` 含 `@agent-engine/plugin-files`（无需 `deps.pluginFactories`）
- **THEN** 用 core 内置工厂构造该 plugin，`read_file` / `write_file` 进入 registry

#### Scenario: 缺失工厂报错

- **WHEN** `config.plugins` 含某名但既非内置、`deps.pluginFactories` 又未提供
- **THEN** 抛出包含该插件名的错误
