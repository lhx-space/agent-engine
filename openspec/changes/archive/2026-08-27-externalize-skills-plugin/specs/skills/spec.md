## REMOVED Requirements

### Requirement: Skill 类型

### Requirement: SKILL.md 加载

### Requirement: CapabilityLoader 检索

## ADDED Requirements

### Requirement: skills 能力外放

skills 能力（`Skill` 类型、`loadSkillFromPath`、检索注入 instruction + 捆绑工具、path/npm/git 来源解析）SHALL 已外放为 `@lhx-agent-engine/plugin-skills`；core SHALL 不再持有 skills 能力实现，只经 `ContextContributor` 统一缝接收其注入的文本与工具。

#### Scenario: 经 plugin-skills 注入

- **WHEN** 装配 `@lhx-agent-engine/plugin-skills` 并运行，检索命中某 skill
- **THEN** 该 skill 的 instruction 与捆绑工具经 `ContextContributor` 注入 system prompt / 临时注册，core 无 skill 硬路径
