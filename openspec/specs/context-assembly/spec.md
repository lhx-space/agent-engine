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

系统 SHALL 提供 `buildSystemPrompt(options)`，渲染 `systemPrompt.template`（用户变量 + 内置 `rules` / `skills` 变量），返回本次调用的 system prompt；`rules` 变量值为 `options.rulesText`、`skills` 变量值为 `options.skillsText`（调用方检索后传入的文本片段）。

#### Scenario: 模板渲染 + rules 占位符注入

- **WHEN** 模板含 `{{rules}}` 且 `rulesText` 非空
- **THEN** 用户变量被替换，`{{rules}}` 被替换为规则文本，结果不含 `{{rules}}` 字面量

#### Scenario: 模板无 rules 占位符时兜底追加

- **WHEN** 模板不含 `{{rules}}` 且 `rulesText` 非空
- **THEN** 规则文本追加到渲染结果末尾

#### Scenario: 未提供 rulesText

- **WHEN** `options.rulesText` 未提供或为空串
- **THEN** `rules` 变量为空串，不注入任何规则文本

#### Scenario: 无匹配规则

- **WHEN** `rulesText` 为空串（无候选）
- **THEN** `{{rules}}` 替换为空串，输出不含残留占位符

### Requirement: skills 片段注入

系统 SHALL 支持 `buildSystemPrompt` 注入 skills 指令片段：`skills` 为内置变量（命中 skills 的 instruction 拼接文本），模板用 `{{skills}}` 声明注入点；未声明占位符且文本非空时兜底追加。

#### Scenario: {{skills}} 占位符注入

- **WHEN** 模板含 `{{skills}}` 且提供非空 skills 文本
- **THEN** `{{skills}}` 被替换为 skills 指令文本，结果不含 `{{skills}}` 字面量

#### Scenario: 无 skills 文本

- **WHEN** 未提供 skills 文本或命中为空
- **THEN** `{{skills}}` 替换为空串，不注入任何内容
