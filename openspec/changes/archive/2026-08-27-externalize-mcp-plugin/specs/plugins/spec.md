## MODIFIED Requirements

### Requirement: Plugin 与 PluginContext

系统 SHALL 定义 `Plugin` 接口（`name` / `description` / `version` / `tags` / `install(ctx)`）与 `PluginContext` 接口（`registerTool` / `registerToolSource` / `registerHook` / `provideSystemPrompt` / `registerGuardrail` / `registerMemoryBackend` / `registerCacheBackend` / `registerVectorStore` / `registerEmbeddingProvider` / `registerTokenCounter` / `registerContextCompactor` / `registerRetriever` / `registerReranker` / `registerSummarizer` / `registerContextContributor`）；plugin 通过 `install(ctx)` 注入能力。

#### Scenario: plugin 注入多种能力

- **WHEN** 一个 plugin 的 `install` 依次调用 `registerTool` / `registerContextContributor` / `provideSystemPrompt`
- **THEN** 对应能力被注入 `PluginContext`，无副作用报错

#### Scenario: plugin 注入存储/检索/上下文后端

- **WHEN** 一个 plugin 的 `install` 调用 `registerMemoryBackend` / `registerVectorStore` / `registerRetriever` 等
- **THEN** 对应后端被收集进能力束，供装配层解析

### Requirement: PluginManager 收集

系统 SHALL 提供 `PluginManager`，`install` / `installAll` 执行 plugin 的 `install`，把注入的能力收集进 `CapabilityBundle`（tools / toolSources / hooks / guardrails / promptFragments / memoryBackends / cacheBackends / vectorStores / embeddingProviders / tokenCounters / contextCompactors / retrievers / rerankers / summarizers / contextContributors，可含 dispose）。

#### Scenario: 安装多个 plugin

- **WHEN** `installAll` 传入多个 plugin
- **THEN** 各 plugin 的能力被收集进同一 `CapabilityBundle`

### Requirement: assembleAgentLoop 装配

系统 SHALL 提供 `assembleAgentLoop(options)`（async）：把 `CapabilityBundle` 的能力合并进 AgentLoop 的 sinks（tools 注册进 ToolRegistry、toolSources resolve 出工具并聚合释放、hooks 注册进 HookPipeline、prompt 片段注入 system prompt、contextContributors 注入循环），最终构造 `AgentLoop`。当传入 `security` 时，SHALL 调用 `registerBuiltinTools` 恒注册两个通用原语；当传入 `tools.disabled` 时，SHALL 在全部工具注册完成后按名移除被禁用工具；todo 规划引导片段仅在 `builtin.todo` 最终仍在 registry 时注入。

#### Scenario: 装配含 plugin 的 Agent

- **WHEN** 传入基础配置与一个注册了 tool 的 plugin
- **THEN** 返回的 `AgentLoop` 的 ToolRegistry 含该 tool，且 run 可用

#### Scenario: 传 security 装配内置工具并注入规划引导

- **WHEN** 传入 `security`（含 `bash.enabled: false`），未禁用 `builtin.todo`
- **THEN** 返回的 `AgentLoop` 的 ToolRegistry 含 `todo` 等内置工具，且 system prompt 含「先列计划」引导片段

#### Scenario: 禁用工具在装配末移除

- **WHEN** 传入 `tools: { disabled: ['builtin.todo'] }`
- **THEN** ToolRegistry 不含 `builtin.todo`，且 system prompt 不含「先列计划」引导片段
