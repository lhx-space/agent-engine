## MODIFIED Requirements

### Requirement: system prompt 组装

系统 SHALL 提供 `buildSystemPrompt(options)`，渲染 `systemPrompt.template`（用户变量 + 内置 `skills` 变量），返回本次调用的 system prompt；`skills` 变量值为 `options.skillsText`（调用方检索后传入的文本片段）。规则注入已外放为 `@lhx-agent-engine/plugin-rules` 的 `ContextContributor`，SHALL 不再占用 `buildSystemPrompt` 的模板占位符。

#### Scenario: 模板渲染 + skills 占位符注入

- **WHEN** 模板含 `{{skills}}` 且 `skillsText` 非空
- **THEN** 用户变量被替换，`{{skills}}` 被替换为技能文本，结果不含 `{{skills}}` 字面量

#### Scenario: 模板无 skills 占位符时兜底追加

- **WHEN** 模板不含 `{{skills}}` 且 `skillsText` 非空
- **THEN** 技能文本追加到渲染结果末尾

#### Scenario: 未提供 skillsText

- **WHEN** `options.skillsText` 未提供或为空串
- **THEN** `skills` 变量为空串，不注入任何技能文本

#### Scenario: 无匹配技能

- **WHEN** `skillsText` 为空串（无候选）
- **THEN** `{{skills}}` 替换为空串，输出不含残留占位符
