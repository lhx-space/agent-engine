# plugin-rules Specification

## Purpose

TBD - created by archiving change externalize-rules-plugin. Update Purpose after archive.

## Requirements

### Requirement: createRulesPlugin 注册 ContextContributor

系统 SHALL 提供 `@agent-engine/plugin-rules` 包，导出 `createRulesPlugin(rules, options?)`，返回 `Plugin`；其 `install(ctx)` SHALL 调用 `ctx.registerContextContributor` 注册一个 `ContextContributor`（`name` 为 `@agent-engine/plugin-rules`）。

#### Scenario: 安装注册 contributor

- **WHEN** 以非空 `rules` 构造 `createRulesPlugin` 并安装到 `PluginContext`
- **THEN** `registerContextContributor` 被调用一次，注册的 contributor 名称为 `@agent-engine/plugin-rules`

#### Scenario: 空 rules 不注册 contributor

- **WHEN** 以空数组 `rules` 构造 `createRulesPlugin` 并安装
- **THEN** 不注册 contributor（或注册的 contributor 贡献为空），不报错

### Requirement: rules 按需加载（loadRulesText）

系统 SHALL 提供 `loadRulesText(rules, onDemand)`：`always` 规则的 content 全部注入 + 检索命中的 `on-demand` 规则（`onDemand`）的 content，去重拼接，输出「本次注入的规则文本」。检索（BM25，或 BM25 + 向量 RRF）SHALL 由 `createRulesPlugin` 内部的自建索引（MiniSearch + 可选向量库，复用 core 的 `hybridRetrieve`）完成；`loadRulesText` SHALL 为纯函数、不内嵌检索、不依赖 `CapabilityLoader`。

#### Scenario: always 规则强制注入

- **WHEN** 存在 `kind='always'` 的规则
- **THEN** 其 content 无条件包含在输出文本中

#### Scenario: on-demand 规则去重拼接

- **WHEN** 传入检索命中的 on-demand 规则列表
- **THEN** 命中的 content 与 always 规则去重后按序拼接；未命中的 on-demand 规则不注入

#### Scenario: 空集合返回空串

- **WHEN** `rules` 为空且 `onDemand` 为空
- **THEN** 输出为空串，不报错

### Requirement: 语义召回（可选 embedding）

系统 SHALL 支持 `createRulesPlugin(rules, { embedding })` 传入 `EmbeddingProvider`：命中判定从纯 BM25 升级为 BM25 + 向量 RRF 融合；未传 `embedding` 时回落纯 BM25。

#### Scenario: 无 embedding 回落 BM25

- **WHEN** `createRulesPlugin` 未传 `embedding` 时贡献规则文本
- **THEN** 命中规则与纯 BM25 检索一致

#### Scenario: 有 embedding 语义补漏

- **WHEN** 传入 `embedding` 且 query 与某 on-demand 规则用词不同但语义相关
- **THEN** 该规则经向量召回 + RRF 融合后被注入

### Requirement: C1 空集合兜底

当检索无候选时，系统 SHALL 返回空贡献（不注入规则文本），不报错。

#### Scenario: 无匹配规则

- **WHEN** 所有 on-demand 规则均与 query 不相关
- **THEN** `contribute` 返回空（或 `text` 为空），流程正常继续
