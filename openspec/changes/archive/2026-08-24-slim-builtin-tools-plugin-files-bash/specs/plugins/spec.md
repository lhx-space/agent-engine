## ADDED Requirements

### Requirement: 内置 plugin（files / bash）

系统 SHALL 提供两个内置 plugin 工厂：`createFilesPlugin`（注册 `read_file` / `write_file`）与 `createBashPlugin`（注册 `bash`，经 `SandboxBackend`）；二者均为 `Plugin` 实现，经 `config.plugins` 声明 `@lhx-agent-engine/plugin-files` / `@lhx-agent-engine/plugin-bash` 时由 resolve 加载。

#### Scenario: files plugin 注册文件工具

- **WHEN** 加载 `@lhx-agent-engine/plugin-files`（提供 `security.files` 策略）
- **THEN** ToolRegistry 含 `read_file` 与 `write_file`

#### Scenario: bash plugin 注册命令工具

- **WHEN** 加载 `@lhx-agent-engine/plugin-bash`（`security.bash.enabled` 为 true 且沙箱可用）
- **THEN** ToolRegistry 含 `bash`，经沙箱执行

#### Scenario: bash 沙箱不可用即禁用

- **WHEN** 加载 `@lhx-agent-engine/plugin-bash` 但沙箱不可用
- **THEN** 抛错（绝不回退宿主进程裸奔）
