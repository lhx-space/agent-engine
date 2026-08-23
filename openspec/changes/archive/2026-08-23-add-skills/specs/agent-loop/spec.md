## ADDED Requirements

### Requirement: skill 集成

系统 SHALL 支持 `AgentLoop` 注入 `skills?: Skill[]`；每次 `run` 经 `SkillLoader` 检索命中的 skills，将其指令注入 system prompt，并将其捆绑工具注册进 ToolRegistry。

#### Scenario: 命中 skill 注入指令并注册工具

- **WHEN** 注入 skills 且 query 命中某 skill（含捆绑工具）
- **THEN** 该 skill 的 instruction 进入 system prompt，其捆绑工具在 LLM 调用前注册进 ToolRegistry

#### Scenario: 未命中不注入

- **WHEN** query 与所有 skill 均不相关
- **THEN** 无 skill 指令注入，无额外工具注册

#### Scenario: 未注入 skills

- **WHEN** 不注入 `skills`
- **THEN** 行为与以往一致
