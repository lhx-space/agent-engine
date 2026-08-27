## Context

内核瘦身重构 Phase 1（规划见 `docs/docs/architecture/refactor-plan.md`）：先加统一扩展缝，不迁移现有能力。`ContextContributor` 是「能力 → context」的唯一入口，后续 rules/skills/documents/memory 都实现它。

## Goals / Non-Goals

**Goals:** `ContextContributor` 接口 + 插件注册 + 装配汇聚 + `AgentLoop` 收集注入（文本 + 临时工具）。

**Non-Goals:** 迁移现有能力（Phase 2）；删除硬分支（Phase 3）；配置骨架化（Phase 3）。

## Decisions

- **D1 接口形状**：`contribute({ userInput }) → Promise<{ text?, tools? } | void>`；`userInput` 为检索查询（与现有能力一致），不传 messages（组装前无完整窗口）。
- **D2 工具生命周期**：贡献的 `tools` 本轮临时注册，run 结束（含异常）还原/移除——与 skill 捆绑工具同语义，防跨 run 残留。
- **D3 best-effort**：单个 contributor 失败隔离（catch → 跳过），不阻断 run；与长期记忆召回 no-op 一致。
- **D4 注入位置**：文本与 `beforeContextCompose` 钩子片段合并，作为 `compose(userInput, injected)` 的素材追加进 system prompt。
- **D5 归置**：接口放 `context/`（上下文概念）；注册经 `PluginContext.registerContextContributor`；承载经 `CapabilityBundle.contextContributors`。

## Risks / Trade-offs

- [工具注册顺序] → 贡献者工具在 compose 后注册，与 skill 工具同阶段；同名冲突沿用「先注册覆盖、结束时还原」。
- [接口演进] → 后续如需给 contributor 看历史/窗口，再扩 `contribute` 入参（Phase 2 迁移时按需）。

## Migration Plan

- 非破坏：纯新增缝；现有能力路径不动。
