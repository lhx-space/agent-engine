## Why

两处架构毛边需要整理（纯重构，行为不变）：

1. **Loader 重复**：`RuleLoader` / `SkillLoader`（以及后续 plugins / mcp 的 Loader）的「注册 meta + BM25 检索」逻辑完全一致，只差「能力类型」和「命中后的加载形态」。按此模式每加一种能力都要复制一遍检索样板。
2. **类型管理散乱**：类型分散在「每模块 `types.ts`」与「内联在实现文件」两种风格之间，且 `AGENTS.md` 目录结构规划的 `core/src/types.ts`（对外核心类型出口）一直未建。

## What Changes

- **抽象 `CapabilityLoader<T>`**：统一「注册 meta + BM25 检索」，返回 `{ record, score }[]`；差异加载交给各能力自己的逻辑。
- **删除 `RuleLoader` / `SkillLoader`**：Rule 加载改为纯函数 `loadRulesText`（always 强制 + on-demand 检索拼接）；Skill 加载在 AgentLoop 内联（检索 + 拼 instruction + 注册工具）。
- **`Skill.name` → `Skill.id`**：统一能力标识（与 `Rule.id` 一致）。
- **`buildSystemPrompt` 改纯**：从「接收 `ruleLoader` 自己检索」改为「接收 `rulesText` / `skillsText` 文本片段」，检索职责回到 AgentLoop。
- **类型整理**：内联类型抽到各模块 `types.ts`（`agent` / `memory` / `context`），新建 `core/src/types.ts` 集中 re-export 对外类型。

## Capabilities

### Modified Capabilities

- `capability-retrieval`: rules 加载 API（`loadRulesForQuery` → `CapabilityLoader` + `loadRulesText`）。
- `skills`: `Skill` 类型（`name` → `id`）+ 加载 API（`SkillLoader` → `CapabilityLoader`）。
- `context-assembly`: `buildSystemPrompt` 参数（`ruleLoader` → `rulesText`）。

## Impact

- 新增 `retrieval/loader.ts`、`rules/load.ts`、`agent/types.ts`、`memory/types.ts`、`context/types.ts`、`src/types.ts`。
- 删除 `rules/loader.ts`、`skills/loader.ts`。
- 修改 `skills/types.ts`、`skills/load.ts`、`context/build-system-prompt.ts`、`agent/loop.ts`、`index.ts` 及多个测试。
- 无行为变更、无新增依赖；对外 API 命名变化（内部未发布，无迁移负担）。
