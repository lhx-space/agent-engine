## MODIFIED Requirements

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
