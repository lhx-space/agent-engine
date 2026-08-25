## MODIFIED Requirements

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
