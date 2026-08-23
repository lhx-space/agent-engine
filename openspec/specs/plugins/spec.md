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

系统 SHALL 提供 `PluginManager`，`install` / `installAll` 执行 plugin 的 `install`，把注入的能力收集进 `PluginAssembly`（tools / skills / hooks / rules / promptFragments）。

#### Scenario: 安装多个 plugin

- **WHEN** `installAll` 传入多个 plugin
- **THEN** 各 plugin 的能力被收集进同一 `PluginAssembly`

### Requirement: assembleAgentLoop 装配

系统 SHALL 提供 `assembleAgentLoop(options)`（async）：安装 `plugins`，把收集的 tools 注册进 ToolRegistry、skills / rules 合并、hooks 注册进 HookPipeline、prompt 片段注入 system prompt，最终构造 `AgentLoop`。当传入 `security` 时，SHALL 调用 `registerBuiltinTools` 按 `tools` 引用装配内置工具，并在注册 `todo` 时向 system prompt 注入「复杂任务先列计划再执行」的规划引导片段。

#### Scenario: 装配含 plugin 的 Agent

- **WHEN** 传入基础配置与一个注册了 tool 的 plugin
- **THEN** 返回的 `AgentLoop` 的 ToolRegistry 含该 tool，且 run 可用

#### Scenario: 传 security 装配内置工具并注入规划引导

- **WHEN** 传入 `security`（含 `bash.enabled: false`）与 `tools` 引用，注册了 `todo`
- **THEN** 返回的 `AgentLoop` 的 ToolRegistry 含 `todo` 等内置工具，且 system prompt 含「先列计划」引导片段
