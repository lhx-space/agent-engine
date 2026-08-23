## ADDED Requirements

### Requirement: skills 片段注入

系统 SHALL 支持 `buildSystemPrompt` 注入 skills 指令片段：`skills` 为内置变量（命中 skills 的 instruction 拼接文本），模板用 `{{skills}}` 声明注入点；未声明占位符且文本非空时兜底追加。

#### Scenario: {{skills}} 占位符注入

- **WHEN** 模板含 `{{skills}}` 且提供非空 skills 文本
- **THEN** `{{skills}}` 被替换为 skills 指令文本，结果不含 `{{skills}}` 字面量

#### Scenario: 无 skills 文本

- **WHEN** 未提供 skills 文本或命中为空
- **THEN** `{{skills}}` 替换为空串，不注入任何内容
