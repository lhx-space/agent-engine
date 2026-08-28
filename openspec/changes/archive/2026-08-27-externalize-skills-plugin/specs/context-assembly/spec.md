## MODIFIED Requirements

### Requirement: system prompt 组装

系统 SHALL 提供 `buildSystemPrompt(options)`，渲染 `systemPrompt.template` 的用户变量，返回本次调用的 system prompt。rules / skills 能力注入已外放为 `@lhx-agent-engine/plugin-rules` / `@lhx-agent-engine/plugin-skills` 的 `ContextContributor`，SHALL 不再占用 `buildSystemPrompt` 的模板占位符。

#### Scenario: 模板渲染用户变量

- **WHEN** 模板含 `{{role}}` 且 `variables.role` 非空
- **THEN** `{{role}}` 被替换为用户变量值，结果不含 `{{role}}` 字面量

#### Scenario: 无用户变量原样返回

- **WHEN** 模板不含占位符
- **THEN** 返回模板原文

## REMOVED Requirements

### Requirement: skills 片段注入
