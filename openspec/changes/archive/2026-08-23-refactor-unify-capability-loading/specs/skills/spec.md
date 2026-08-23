## ADDED Requirements

### Requirement: CapabilityLoader 检索

系统 SHALL 支持用 `CapabilityLoader('skill', skills)` 把 skills 注册进 `CapabilityRegistry`，`loadForQuery(query, topK)` 返回 BM25 命中的 Skill 记录（含 score）。

#### Scenario: 关键词召回

- **WHEN** 以「帮我做事故响应」检索，存在 description 含「事故响应流程」的 skill
- **THEN** 该 skill 被召回且 score 较高

#### Scenario: 不相关不召回

- **WHEN** 检索与所有 skill description 均不相关
- **THEN** 返回空列表，不注入任何 skill

## MODIFIED Requirements

### Requirement: Skill 类型

系统 SHALL 定义 `Skill` 类型，含 `id`（唯一标识）、`description`（匹配面）、`instruction`（SKILL.md 正文指令）、`tags`（同义词）、可选 `tools`（捆绑工具）。

#### Scenario: 最小 skill

- **WHEN** 定义仅含 `id` / `description` / `instruction` / `tags` 的 skill
- **THEN** 该 skill 为合法对象，无捆绑工具

#### Scenario: 带捆绑工具的 skill

- **WHEN** skill 声明 `tools`
- **THEN** 加载后其工具可注册进 ToolRegistry

### Requirement: SKILL.md 加载

系统 SHALL 提供 `loadSkillFromPath(path)`，读取 SKILL.md 并解析 frontmatter（name / description）与正文（instruction），返回 `Skill`（frontmatter 的 `name` 映射为 `Skill.id`）。

#### Scenario: 加载带 frontmatter 的 SKILL.md

- **WHEN** SKILL.md 含 `name` / `description` frontmatter 与正文
- **THEN** 返回 Skill，`id` / `description` 取自 frontmatter、`instruction` 为正文

## REMOVED Requirements

### Requirement: SkillLoader 检索
