# context-assembly Specification

## Purpose

TBD - created by archiving change add-context-assembly. Update Purpose after archive.

## Requirements

### Requirement: 模板渲染

系统 SHALL 提供 `renderTemplate(template, variables)`，将模板中的 `{{name}}` 占位符替换为 `variables` 中同名变量的值；未提供的变量 SHALL 保留原样，值为 null / undefined 的变量 SHALL 替换为空串。

#### Scenario: 替换变量

- **WHEN** 模板为 `你好 {{name}}` 且 `variables = { name: '世界' }`
- **THEN** 渲染结果为 `你好 世界`

#### Scenario: 未提供变量保留原样

- **WHEN** 模板含 `{{name}}` 但 `variables` 无该 key
- **THEN** `{{name}}` 原样保留，不替换

#### Scenario: null / undefined 替换为空串

- **WHEN** 模板含 `{{x}}` 且 `variables.x` 为 null 或 undefined
- **THEN** `{{x}}` 替换为空串

### Requirement: system prompt 组装

系统 SHALL 提供 `buildSystemPrompt(query, options)`，渲染 `systemPrompt.template`（用户变量 + 内置 `rules` 变量），返回本次调用的 system prompt；`rules` 变量值为 `ruleLoader.loadForQuery(query)` 的结果。

#### Scenario: 模板渲染 + rules 占位符注入

- **WHEN** 模板含 `{{rules}}` 且 `ruleLoader` 检索到规则
- **THEN** 用户变量被替换，`{{rules}}` 被替换为规则文本，结果不含 `{{rules}}` 字面量

#### Scenario: 模板无 rules 占位符时兜底追加

- **WHEN** 模板不含 `{{rules}}` 且 `ruleLoader` 检索到非空规则文本
- **THEN** 规则文本追加到渲染结果末尾

#### Scenario: 未提供 ruleLoader

- **WHEN** `options.ruleLoader` 未提供
- **THEN** `rules` 变量为空串，不注入任何规则文本

#### Scenario: 无匹配规则

- **WHEN** `ruleLoader` 对 query 无候选（返回空串）
- **THEN** `{{rules}}` 替换为空串，输出不含残留占位符
