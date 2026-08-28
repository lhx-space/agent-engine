## Context

skills 与 rules 同构：都是「匹配 meta → 检索 → 注入 context」，差异只在 skill 还带可选捆绑工具。rules 已外放 `plugin-rules`，本 change 用同一模板外放 skills，并把 skill 工具注册从 `AgentLoop` 特殊处理收敛进 `ContextContributor` 的 `tools` 通道（Phase 1 已支持）。

## Goals / Non-Goals

**Goals:**

- skills 外放 `@lhx-agent-engine/plugin-skills`，走 `ContextContributor` 统一缝（text + tools）。
- core 删除 skill 硬路径与 `registerSkill` 能力轴。
- `buildSystemPrompt` 清理 `{{skills}}` 残留。

**Non-Goals:**

- 不改检索算法与 RRF 语义。
- 不删 `CapabilityLoader` / `CapabilityRegistry` / `CapabilityType`（Phase 3 再删）。
- 不改 `config.skills` schema。

## Decisions

### D1: skill 工具注册走 `ContextContributor` 的 `tools` 通道

**选择**：`createSkillsPlugin` 的 contributor 检索命中后返回 `{ text: instruction 拼接, tools: 命中 skills 的捆绑工具 }`；由 `AgentLoop` 已有的 contributor 工具临时注册机制处理（run 结束还原）。

**理由**：Phase 1 已实现 contributor `tools` 的 run-scoped 注册/还原；skill 捆绑工具天然是该语义。删除 `AgentLoop` 里「遍历 `skillHits` 注册工具」的特殊分支，能力注入完全统一。

### D2: 来源解析（`resolveSkills`）一并外放

**选择**：`resolveSkill` / `resolveSkills` / `createDefaultSkillSourceDeps` 迁入 `plugin-skills`，与 `loadSkillFromPath` 同包。

**理由**：`config.skills`（`SkillRef[]`：path/npm/git）的解释是 skill 能力的入口，与 `plugin-rules` 解释 `config.rules`、`plugin-guardrails` 解释 `config.guardrails` 对称。core 不再认识 `SkillRef` 的解析细节。

### D3: `buildSystemPrompt` 只渲染用户变量

**选择**：删除 `BuildSystemPromptOptions.skillsText` 与 `{{skills}}` 变量/兜底追加；`buildSystemPrompt` 退化为 `SystemPrompt` 模板对象的用户变量渲染。

**理由**：rules / skills 注入均已外放为 `ContextContributor` 追加文本，模板占位符失去消费者；保留会误导「能力还在 core 组装」。

## Risks / Trade-offs

- [`{{skills}}` 模板占位符移除] 用户 systemPrompt 模板里若写了 `{{skills}}`，将不再被替换（skill 指令改由 contributor 追加）。语义迁移，符合 D2（统一缝）。
- [skill 加载副作用外移] `resolveSkills` 的临时目录清理（npm/git 拉取）随插件生命周期管理，core 不再聚合 `disposeSkills`；组合层需在装配 `plugin-skills` 时持有其 dispose（Phase 4 处理）。
