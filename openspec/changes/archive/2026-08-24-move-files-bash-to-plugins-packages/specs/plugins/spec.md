## MODIFIED Requirements

### Requirement: 内置 plugin（files / bash）

系统 SHALL 提供两个独立 plugin 包 `@lhx-agent-engine/plugin-files`（`createFilesPlugin(policy)`，注册 `read_file` / `write_file`）与 `@lhx-agent-engine/plugin-bash`（`createBashPlugin(policy, sandbox)`，注册 `bash`，`install` 时校验 `bash.enabled`）；二者均为 `Plugin` 实现，经 `config.plugins` 声明并由装配层注入工厂后加载。

#### Scenario: files plugin 注册文件工具

- **WHEN** 以 `FilePolicy` 构造 `createFilesPlugin` 并安装
- **THEN** ToolRegistry 含 `read_file` 与 `write_file`

#### Scenario: bash plugin 注册命令工具

- **WHEN** `bash.enabled` 为 true 且提供可用沙箱，构造并安装 `createBashPlugin`
- **THEN** ToolRegistry 含 `bash`，经沙箱执行

#### Scenario: bash 未启用抛错

- **WHEN** `bash.enabled` 为 false 时安装 `createBashPlugin`
- **THEN** 抛错（不注册 bash）
