# plugin-skills Specification

## Purpose

TBD - created by archiving change externalize-skills-plugin. Update Purpose after archive.

## Requirements

### Requirement: createSkillsPlugin 注册 ContextContributor

系统 SHALL 提供 `@agent-engine/plugin-skills` 包，导出 `createSkillsPlugin(skills, options?)`，返回 `Plugin`；其 `install(ctx)` SHALL 调用 `ctx.registerContextContributor` 注册一个 `ContextContributor`（`name` 为 `@agent-engine/plugin-skills`）。每次 run，contributor SHALL 自建索引（MiniSearch + 可选向量，复用 core 的 `hybridRetrieve`）检索命中 skills，注入 instruction 拼接文本 + 命中 skills 的捆绑工具。

#### Scenario: 安装注册 contributor

- **WHEN** 以非空 `skills` 构造 `createSkillsPlugin` 并安装
- **THEN** `registerContextContributor` 被调用，注册的 contributor 名称为 `@agent-engine/plugin-skills`

#### Scenario: 检索命中注入 instruction + 工具

- **WHEN** 命中一个带 `tools` 的 skill
- **THEN** `contribute` 返回 `{ text, tools }`，`text` 含该 skill 的 instruction、`tools` 含其捆绑工具

#### Scenario: 不相关不召回

- **WHEN** 检索与所有 skill description 均不相关
- **THEN** `contribute` 返回空（不注入文本与工具），不报错

### Requirement: Skill 类型

系统 SHALL 定义 `Skill` 类型，含 `id`（唯一标识）、`description`（匹配面）、`instruction`（SKILL.md 正文指令）、`tags`（同义词）、可选 `tools`（捆绑工具）。

#### Scenario: 最小 skill

- **WHEN** 定义仅含 `id` / `description` / `instruction` / `tags` 的 skill
- **THEN** 该 skill 为合法对象，无捆绑工具

#### Scenario: 带捆绑工具的 skill

- **WHEN** skill 声明 `tools`
- **THEN** 命中后其工具经 contributor 临时注册进 ToolRegistry

### Requirement: SKILL.md 加载

系统 SHALL 提供 `loadSkillFromPath(path)`，读取 SKILL.md 并解析 frontmatter（name / description / tags）与正文（instruction），返回 `Skill`（frontmatter 的 `name` 映射为 `Skill.id`）；frontmatter 缺 name / description 时 SHALL 抛错。

#### Scenario: 加载带 frontmatter 的 SKILL.md

- **WHEN** SKILL.md 含 `name` / `description` frontmatter 与正文
- **THEN** 返回 Skill，`id` / `description` 取自 frontmatter、`instruction` 为正文

### Requirement: 技能来源解析

系统 SHALL 提供 `resolveSkill(ref, deps?)` 与 `resolveSkills(refs, deps?)`，按 `SkillRef` 来源（path 直读 / npm pack+tar 解包 / git clone）解析为 `Skill`，并聚合临时资源 `dispose`；`SkillSourceDeps`（exec / mkdtemp / rm / readSkill）SHALL 可注入以便测试。

#### Scenario: path 来源直读

- **WHEN** `source: 'path'` 时解析
- **THEN** 直接经 `deps.readSkill` 加载，无临时目录副作用

#### Scenario: git 来源 clone

- **WHEN** `source: 'git'` 且带 `ref` 时解析
- **THEN** 执行 `git clone --depth 1 --branch <ref> <url> <dir>` 后加载

#### Scenario: 批量解析聚合 dispose

- **WHEN** 以多个 refs 调用 `resolveSkills`
- **THEN** 返回全部 skills 与统一 `dispose`（释放各来源临时资源）
