## Why

统一能力检索调度（AGENTS.md 5.5）已用 rules 验证（content 纯文本最简）。skills 是第二个接入：**可复用能力包 = 一份 SKILL.md 指令 + 可选捆绑工具**，按需加载——BM25 检索命中后，注入指令到 system prompt、捆绑工具注册进 ToolRegistry。

当前 `AgentConfig.skills`（`{ path }` 引用）无消费方：AgentLoop 无法按需加载 skill 能力，配置声明了 skills 也不生效。本 change 打通 skills 的「检索 → 差异加载（指令注入 + 工具注册）」链路。

## What Changes

- **`Skill` 类型**：`name` + `description`（匹配面）+ `instruction`（SKILL.md 正文）+ `tools?`（捆绑工具）+ `tags?`。
- **`SkillLoader`**：把 skills 注册进 `CapabilityRegistry`（`type='skill'`），`loadForQuery(query, topK)` 返回命中的 Skill 列表（含 score）。
- **`loadSkillFromPath`**：从路径读 SKILL.md，用 `gray-matter` 解析 frontmatter（name/description）与正文 instruction。
- **`buildSystemPrompt` 扩展**：内置 `{{skills}}` 变量（命中 skills 的指令拼接），未声明占位符时兜底追加。
- **AgentLoop 集成**：`skills?: Skill[]` 选项，每次 run 检索命中 skills → 指令注入 + 捆绑工具注册进 ToolRegistry。

## Capabilities

### New Capabilities

- `skills`: Skill 类型、SkillLoader 检索、SKILL.md 加载（gray-matter）。

### Modified Capabilities

- `context-assembly`: `buildSystemPrompt` 增加 `{{skills}}` 内置变量注入。
- `agent-loop`: 集成 skills（检索 → 指令注入 + 捆绑工具注册）。

## Impact

- 新增 `packages/core/src/skills/`（types / loader / load）。
- 修改 `packages/core/src/context/build-system-prompt.ts`、`agent/loop.ts`、`index.ts`。
- 依赖：新增 `gray-matter`（frontmatter 解析，复用优先）。
- 无 breaking changes（skills 为可选增量）。
