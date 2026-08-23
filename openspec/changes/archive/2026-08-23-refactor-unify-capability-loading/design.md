## Context

rules / skills 已各自实现 Loader，二者「注册 + 检索」重复。后续 plugins / mcp 也会要同类 Loader，重复会扩散。同时类型定义风格不统一，缺对外类型出口。

## Goals / Non-Goals

**Goals:**

- `CapabilityLoader<T>` 统一「注册 + 检索」，消除 Loader 重复。
- `Skill.name` → `id`，与 `Rule.id` 对齐能力标识。
- `buildSystemPrompt` 改纯（接收文本片段，不内嵌检索）。
- 类型统一：每模块 `types.ts` + `core/src/types.ts` 对外出口。

**Non-Goals:**

- 不改检索算法（BM25 / Intl.Segmenter 不变）。
- 不改 hooks / guardrail / memory 的行为语义。
- 不引入依赖注入框架或抽象基类继承体系（用组合 + 泛型，保持轻量）。

## Decisions

### D1: CapabilityLoader 用泛型 + 组合，非继承

**选择**：`CapabilityLoader<T extends CapabilityRecord>` 独立类，`T` 提供 `id` / `description` / `tags`；Rule / Skill 作为普通数据类型传入。

**理由**：加载器是「注册 + 检索」的纯逻辑，与能力类型无关；泛型约束最小、无继承耦合，符合「内核轻量胶水层」定位。

### D2: 差异加载外置

**选择**：`CapabilityLoader` 只做 on-demand 检索；Rule 的 `always` 强制注入在 `loadRulesText` 纯函数处理；Skill 的「拼 instruction + 注册工具」在 AgentLoop 内联。

**理由**：「检索层统一，加载层按 type 分派」是 5.5 的核心；always 是 Rule 特有语义，工具注册有副作用（注册表），不适合塞进通用 loader。

### D3: Skill.name → id

**选择**：`Skill` 用 `id` 作为唯一标识，`loadSkillFromPath` 把 SKILL.md frontmatter 的 `name` 映射为 `Skill.id`。

**理由**：`Rule.id` 已是 id，统一能力标识让 `CapabilityLoader` 直接取 `record.id`，无需 per-type 的 id 提取函数；SKILL.md 的 frontmatter `name` 是文件惯例，映射留在加载边界。

### D4: buildSystemPrompt 改为纯组装

**选择**：`buildSystemPrompt(options)` 接收 `rulesText` / `skillsText`（已拼好的文本），去掉 `query` 与 `ruleLoader` 参数。

**理由**：让 context 模块「只组装、不检索」，职责更纯；检索编排回到 AgentLoop，与 `CapabilityLoader` 配合。

### D5: 类型整理——每模块 types.ts + 集中出口

**选择**：内联类型（`SystemPromptInput` / `AgentLoopOptions` / `AgentLoopResult`、`ConversationMemoryOptions`、`BuildSystemPromptOptions`）抽到各模块 `types.ts`；新建 `core/src/types.ts` re-export 对外类型。

**理由**：统一「每模块一个 types.ts」约定（就近定义、模块内聚），`src/types.ts` 作为单一对外出口（对齐 AGENTS.md 目录结构）。

## Risks / Trade-offs

- [泛型约束 `tags: string[]`] → 要求各能力 `tags` 非可选；`loadSkillFromPath` 兜底 `tags: []`。
- [buildSystemPrompt 去掉 query] → 调用方（AgentLoop）需先检索再传文本；职责迁移清晰，无行为损失。
- [API 命名变化] → 内部未发布，无外部迁移；测试同步更新。

## Migration Plan

仓库内同步：删除 `RuleLoader` / `SkillLoader`，改 `CapabilityLoader` + `loadRulesText`；测试全部更新。无外部迁移。
