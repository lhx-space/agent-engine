## ADDED Requirements

### Requirement: Summarizer 注入

`PluginContext` SHALL 提供 `registerSummarizer(summarizer)`，插件经它注册自定义摘要策略；`CapabilityBundle` SHALL 含 `summarizers: Summarizer[]`，经 `mergeBundles` 汇聚进装配层（插件注册的优先于默认 `LLMSummarizer`）。

#### Scenario: 插件注册 Summarizer

- **WHEN** 插件在 `install` 内调用 `ctx.registerSummarizer(s)`
- **THEN** 该策略进入 `CapabilityBundle.summarizers`，装配后被会话窗口采用
