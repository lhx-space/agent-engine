## Why

skills 能力仍以 core 一等公民存在：`Skill` 类型（`skills/types.ts`）、`loadSkillFromPath`（`skills/load.ts`）、`resolveSkill`/`resolveSkills`（`capability-source/skill.ts`）、`AgentLoop` 的 `skillLoader` 检索 + skill 工具注册、`ContextComposer` 的 `skillLoader`/`skillsText`、`buildSystemPrompt` 的 `{{skills}}` 占位符。这违背「能力外放、core 只留协议 + 引擎」。

本 change 把 skills 外放为 `@agent-engine/plugin-skills`，走 `ContextContributor` 统一缝（检索命中注入 instruction 文本 + 捆绑工具），core 删除 skill 硬路径与 `registerSkill` 能力轴。与 `plugin-rules` 完全对称。

## What Changes

- **新增 `@agent-engine/plugin-skills`**：`createSkillsPlugin(skills, options?)`（自建索引 + `hybridRetrieve` + `ContextContributor`）；迁入 `Skill` 类型、`loadSkillFromPath`、`resolveSkill`/`resolveSkills`/`createDefaultSkillSourceDeps`。
- **core 删 skill 硬路径**：删 `skills/` 目录、`capability-source/skill.ts`；`AgentLoop` 去掉 `skillLoader`/`skills`/skill 工具注册；`ContextComposer` 去掉 `skillLoader`/`skillsText`/`skillHits`。
- **core 删 skill 能力轴**：`PluginContext.registerSkill`、`CapabilityBundle.skills`、`skill.loaded` 事件删除。
- **core 清理**：`buildSystemPrompt` 移除 `skillsText`/`{{skills}}`（能力注入统一走 `ContextContributor`），只渲染用户变量。
- **config 零迁移（D1-A）**：`config.skills` 字段不变，解释权移交 `@agent-engine/plugin-skills`。

## Capabilities

### New Capabilities

- `plugin-skills`: `@agent-engine/plugin-skills` 提供 `createSkillsPlugin`（检索 + 注入 + 工具）、`loadSkillFromPath`、`resolveSkill`/`resolveSkills`。

### Modified Capabilities

- `skills`: 移除 `Skill` 类型、`loadSkillFromPath`、`CapabilityLoader 检索` 需求（迁至 `plugin-skills`）。
- `plugins`: `PluginContext` 移除 `registerSkill`；`CapabilityBundle` 移除 `skills`；装配不再合并 skills。
- `context-assembly`: `buildSystemPrompt` 移除 `skillsText`/`{{skills}}`，只渲染用户变量。
- `events`: `AgentEngineEvent` 移除 `skill.loaded`。

## Impact

- 新增 `packages/plugins/plugin-skills/`（package.json / tsconfig / tsdown / src / tests / README）。
- 修改 `packages/core/src/{skills/*,capability-source/{skill.ts,types.ts,index.ts},agent/{loop,assemble,types}.ts,context/{context-composer,build-system-prompt,types}.ts,plugins/{types,manager}.ts,capability/{types,bundle}.ts,events/types.ts,resolve/resolve.ts,index.ts,types.ts,tsdown.config.ts,package.json}`。
- 迁移 `packages/core/tests/{skills,capability-source,context-composer,context,demo,resolve}.test.ts`。
- 兼容性：`config.skills` 字段不变。
