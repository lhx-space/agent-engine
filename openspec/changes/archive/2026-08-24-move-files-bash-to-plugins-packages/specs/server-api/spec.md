## ADDED Requirements

### Requirement: 内置 plugin 工厂注入

server SHALL 提供 `createBuiltinPluginFactories(config)`，为 `@agent-engine/plugin-files` / `@agent-engine/plugin-bash` / `@agent-engine/plugin-git` 构造工厂（闭包捕获 `security`，bash/git 的沙箱惰性解析）；`resolveAgentConfig` 调用时 SHALL 合并这些内置工厂与 `options.pluginFactories`。

#### Scenario: 内置 plugin 按声明加载

- **WHEN** 请求 config 的 `plugins` 含 `@agent-engine/plugin-files`
- **THEN** server 注入其工厂，`read_file` / `write_file` 进入 registry（无需外部 pluginFactories）

#### Scenario: 用户工厂覆盖内置

- **WHEN** `options.pluginFactories` 提供同名工厂
- **THEN** 用户工厂优先（内置工厂被覆盖）
