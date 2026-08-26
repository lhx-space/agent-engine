## ADDED Requirements

### Requirement: beforeContextCompose 钩子

系统 SHALL 提供 `beforeContextCompose(userInput): Promise<string | void>` 钩子，在每次 `run` 组装上下文前触发一次；返回字符串时 SHALL 作为外部素材片段追加进 system prompt（供 claude.md / 项目摘要等环境素材注入）。

#### Scenario: 注入片段

- **WHEN** 某 hook 的 `beforeContextCompose` 返回非空字符串
- **THEN** 该字符串追加进最终 system prompt
