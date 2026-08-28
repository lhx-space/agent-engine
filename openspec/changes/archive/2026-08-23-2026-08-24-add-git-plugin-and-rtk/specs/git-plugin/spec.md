## ADDED Requirements

### Requirement: git-plugin 包与工厂

系统 SHALL 提供 `@lhx-agent-engine/plugin-git` 包，导出 `createGitPlugin(options)` 工厂（`options` 含 `sandbox`（`SandboxBackend`）与可选 `policy`），返回实现 `Plugin` 接口的对象。

#### Scenario: 创建插件

- **WHEN** 以 sandbox 与策略调用 `createGitPlugin`
- **THEN** 返回的 `Plugin` 可通过 `PluginManager.install` 安装

### Requirement: git 工具

系统 SHALL 在 git plugin 安装时注册 `git` 工具，入参含 `args`（git 命令参数数组）；执行时经 `SandboxBackend` 以 `command: 'git'` 执行，并携带 `compact: true`（rtk 压缩）。

#### Scenario: 只读命令执行

- **WHEN** 调用 `git` 工具传入只读子命令（如 `['status']`）
- **THEN** 经沙箱执行 `git status`，结果回填

#### Scenario: 破坏性命令阻断

- **WHEN** 传入破坏性子命令（如 `['push']`）且未在 allow 策略中
- **THEN** 阻断并抛可读错误，不执行
