## MODIFIED Requirements

### Requirement: 动态 systemPrompt

系统 SHALL 支持 `systemPrompt` 为静态字符串、模板对象（`SystemPrompt`）或函数式；每次 `run` 动态解析后，rules / skills 检索文本 SHALL 兜底追加到最终 system prompt（字符串 / 函数式形态同样生效，不静默丢弃）。

#### Scenario: 静态 systemPrompt 追加 rules

- **WHEN** 注入字符串 `systemPrompt` 且提供 `rules`
- **THEN** 最终 system 消息内容 = 原字符串 + 兜底追加的 rules 文本

#### Scenario: 函数式 systemPrompt 追加 rules

- **WHEN** 注入函数式 `systemPrompt` 且提供 `rules`
- **THEN** 函数返回值后兜底追加 rules 文本

#### Scenario: 模板对象不变

- **WHEN** `systemPrompt` 为模板对象
- **THEN** 仍经 `buildSystemPrompt` 渲染变量并注入 rules/skills（行为不变）

### Requirement: skill 集成

系统 SHALL 支持 `AgentLoop` 注入 `skills?: Skill[]`；每次 `run` 经 `SkillLoader` 检索命中的 skills，将其指令注入 system prompt，并将其捆绑工具注册进 ToolRegistry；`run` 结束时（含异常）SHALL 清理本轮注册的 skill 工具（还原被覆盖的同名工具），避免跨 run 残留、工具面膨胀。

#### Scenario: 命中 skill 注入指令并注册工具

- **WHEN** 注入 skills 且 query 命中某 skill（含捆绑工具）
- **THEN** 该 skill 的 instruction 进入 system prompt，其捆绑工具在 LLM 调用前注册进 ToolRegistry

#### Scenario: run 结束清理 skill 工具

- **WHEN** 某次 run 注册了 skill 捆绑工具
- **THEN** run 结束（含异常）后，该工具从 ToolRegistry 移除；若覆盖了同名已有工具则还原

#### Scenario: 未命中不注入

- **WHEN** query 与所有 skill 均不相关
- **THEN** 无 skill 指令注入，无额外工具注册
