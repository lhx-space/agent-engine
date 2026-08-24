# plugins Specification

## Purpose

TBD - created by archiving change add-plugins. Update Purpose after archive.

## Requirements

### Requirement: Plugin 与 PluginContext

系统 SHALL 定义 `Plugin` 接口（`name` / `description` / `version` / `tags` / `install(ctx)`）与 `PluginContext` 接口（`registerTool` / `registerSkill` / `registerHook` / `registerRule` / `provideSystemPrompt`）；plugin 通过 `install(ctx)` 注入能力。

#### Scenario: plugin 注入多种能力

- **WHEN** 一个 plugin 的 `install` 依次调用 `registerTool` / `registerRule` / `provideSystemPrompt`
- **THEN** 对应能力被注入 `PluginContext`，无副作用报错

### Requirement: PluginManager 收集

系统 SHALL 提供 `PluginManager`，`install` / `installAll` 执行 plugin 的 `install`，把注入的能力收集进 `CapabilityBundle`（tools / skills / hooks / rules / promptFragments，可含 dispose）。

#### Scenario: 安装多个 plugin

- **WHEN** `installAll` 传入多个 plugin
- **THEN** 各 plugin 的能力被收集进同一 `CapabilityBundle`

### Requirement: assembleAgentLoop 装配

系统 SHALL 提供 `assembleAgentLoop(options)`（async）：把 `CapabilityBundle` 的能力合并进 AgentLoop 的 sinks（tools 注册进 ToolRegistry、skills / rules 合并、hooks 注册进 HookPipeline、prompt 片段注入 system prompt），最终构造 `AgentLoop`。当传入 `security` 时，SHALL 调用 `registerBuiltinTools` 按 `tools` 引用装配内置工具，并在注册 `todo` 时向 system prompt 注入「复杂任务先列计划再执行」的规划引导片段。

#### Scenario: 装配含 plugin 的 Agent

- **WHEN** 传入基础配置与一个注册了 tool 的 plugin
- **THEN** 返回的 `AgentLoop` 的 ToolRegistry 含该 tool，且 run 可用

#### Scenario: 传 security 装配内置工具并注入规划引导

- **WHEN** 传入 `security`（含 `bash.enabled: false`）与 `tools` 引用，注册了 `todo`
- **THEN** 返回的 `AgentLoop` 的 ToolRegistry 含 `todo` 等内置工具，且 system prompt 含「先列计划」引导片段

### Requirement: 内置 plugin（files / bash）

系统 SHALL 提供两个独立 plugin 包 `@agent-engine/plugin-files`（`createFilesPlugin(policy)`，注册 `read_file` / `write_file`）与 `@agent-engine/plugin-bash`（`createBashPlugin(policy, sandbox)`，注册 `bash`，`install` 时校验 `bash.enabled`）；二者均为 `Plugin` 实现，经 `config.plugins` 声明并由装配层注入工厂后加载。

#### Scenario: files plugin 注册文件工具

- **WHEN** 以 `FilePolicy` 构造 `createFilesPlugin` 并安装
- **THEN** ToolRegistry 含 `read_file` 与 `write_file`

#### Scenario: bash plugin 注册命令工具

- **WHEN** `bash.enabled` 为 true 且提供可用沙箱，构造并安装 `createBashPlugin`
- **THEN** ToolRegistry 含 `bash`，经沙箱执行

#### Scenario: bash 未启用抛错

- **WHEN** `bash.enabled` 为 false 时安装 `createBashPlugin`
- **THEN** 抛错（不注册 bash）
