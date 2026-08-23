## ADDED Requirements

### Requirement: 内建规则检索注入

系统 SHALL 支持 `systemPrompt` 为模板对象（`SystemPrompt`）并配合 `rules`（上下文规则）在每次 `run` 自动完成「检索 → 注入」：模板经变量渲染，`rules` 经 `RuleLoader` 按 userInput 检索后注入；guardrail 注册表字段 SHALL 命名为 `guardrails`，与上下文规则 `rules` 分离。

#### Scenario: 模板对象 + rules 自动检索

- **WHEN** `systemPrompt` 为模板对象且提供 `rules`（含 always 与 on-demand）
- **THEN** 每次 run 渲染模板变量，并注入 always 规则与 BM25 召回的相关 on-demand 规则

#### Scenario: 模板对象无 rules

- **WHEN** `systemPrompt` 为模板对象但未提供 `rules`
- **THEN** 仅渲染模板变量，不注入规则

#### Scenario: guardrails 与 rules 分离

- **WHEN** 注入 guardrail 注册表与上下文规则
- **THEN** guardrail 走 `guardrails` 字段，上下文规则走 `rules` 字段，互不干扰
