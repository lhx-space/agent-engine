# plugins Specification

## Purpose

TBD - created by archiving change add-plugins. Update Purpose after archive.

## Requirements

### Requirement: Plugin 与 PluginContext

系统 SHALL 定义 `Plugin` 接口（`name` / `description` / `version` / `tags` / `install(ctx)`）与 `PluginContext` 接口（`registerTool` / `registerSkill` / `registerHook` / `registerRule` / `provideSystemPrompt` / `registerMemoryBackend` / `registerCacheBackend` / `registerVectorStore` / `registerEmbeddingProvider`）；plugin 通过 `install(ctx)` 注入能力。

#### Scenario: plugin 注入多种能力

- **WHEN** 一个 plugin 的 `install` 依次调用 `registerTool` / `registerRule` / `provideSystemPrompt`
- **THEN** 对应能力被注入 `PluginContext`，无副作用报错

#### Scenario: plugin 注入存储与检索后端

- **WHEN** 一个 plugin 的 `install` 调用 `registerMemoryBackend` / `registerCacheBackend` / `registerVectorStore` / `registerEmbeddingProvider`
- **THEN** 对应后端被收集进能力束，供装配层解析

### Requirement: PluginManager 收集

系统 SHALL 提供 `PluginManager`，`install` / `installAll` 执行 plugin 的 `install`，把注入的能力收集进 `CapabilityBundle`（tools / skills / hooks / rules / promptFragments / memoryBackends / cacheBackends / vectorStores / embeddingProviders，可含 dispose）。

#### Scenario: 安装多个 plugin

- **WHEN** `installAll` 传入多个 plugin
- **THEN** 各 plugin 的能力被收集进同一 `CapabilityBundle`

### Requirement: assembleAgentLoop 装配

系统 SHALL 提供 `assembleAgentLoop(options)`（async）：把 `CapabilityBundle` 的能力合并进 AgentLoop 的 sinks（tools 注册进 ToolRegistry、skills / rules 合并、hooks 注册进 HookPipeline、prompt 片段注入 system prompt），最终构造 `AgentLoop`。当传入 `security` 时，SHALL 调用 `registerBuiltinTools` 恒注册四个通用原语；当传入 `tools.disabled` 时，SHALL 在全部工具（builtin / plugin / mcp）注册完成后按名移除被禁用工具；todo 规划引导片段仅在 `builtin.todo` 最终仍在 registry 时注入。

#### Scenario: 装配含 plugin 的 Agent

- **WHEN** 传入基础配置与一个注册了 tool 的 plugin
- **THEN** 返回的 `AgentLoop` 的 ToolRegistry 含该 tool，且 run 可用

#### Scenario: 传 security 装配内置工具并注入规划引导

- **WHEN** 传入 `security`（含 `bash.enabled: false`），未禁用 `builtin.todo`
- **THEN** 返回的 `AgentLoop` 的 ToolRegistry 含 `todo` 等内置工具，且 system prompt 含「先列计划」引导片段

#### Scenario: 禁用工具在装配末移除

- **WHEN** 传入 `tools: { disabled: ['builtin.todo'] }`
- **THEN** ToolRegistry 不含 `builtin.todo`，且 system prompt 不含「先列计划」引导片段

### Requirement: 内置 plugin（files / bash）

系统 SHALL 提供两个独立 plugin 包 `@agent-engine/plugin-files`（`createFilesPlugin(policy)`，注册 `read_file` / `write_file` / `list_files`）与 `@agent-engine/plugin-bash`（`createBashPlugin(policy, sandbox)`，注册 `bash`，`install` 时校验 `bash.enabled`）；二者均为 `Plugin` 实现，经 `config.plugins` 声明并由装配层注入工厂后加载。`read_file` 截断 SHALL 在 UTF-8 字符边界进行（不切断多字节字符）。

#### Scenario: files plugin 注册文件工具

- **WHEN** 以 `FilePolicy` 构造 `createFilesPlugin` 并安装
- **THEN** ToolRegistry 含 `read_file`、`write_file` 与 `list_files`

#### Scenario: list_files 列举目录

- **WHEN** 以含允许 `roots` 的 `FilePolicy` 构造 `list_files` 工具，调用传入根内路径
- **THEN** 返回该目录下的文件/子目录条目（相对路径 + 类型），越界路径抛错

#### Scenario: list_files glob 过滤与上限

- **WHEN** 调用 `list_files` 传入 `glob` 与 `maxEntries`
- **THEN** 仅返回匹配 glob 的条目，且条数不超过 `maxEntries`（超限置 `truncated`）

#### Scenario: bash plugin 注册命令工具

- **WHEN** `bash.enabled` 为 true 且提供可用沙箱，构造并安装 `createBashPlugin`
- **THEN** ToolRegistry 含 `bash`，经沙箱执行

#### Scenario: bash 未启用抛错

- **WHEN** `bash.enabled` 为 false 时安装 `createBashPlugin`
- **THEN** 抛错（不注册 bash）
