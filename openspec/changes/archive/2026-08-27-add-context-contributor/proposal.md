## Why

内核瘦身重构（`docs/docs/architecture/refactor-plan.md`）Phase 1：rules/skills/documents/memory 等能力最终都收敛成「往 context 贡献一段文本 + 可选工具」。当前没有这个统一缝，`ContextComposer` 里硬编码了四条能力分支。先引入 `ContextContributor`，让插件能注册「上下文贡献者」，为 Phase 2 逐个迁移铺路。

## What Changes

- `core/src/context/context-contributor.ts`：新增 `ContextContributor` 接口（`contribute({ userInput }) → { text?, tools? } | void`）。
- `PluginContext.registerContextContributor` + `CapabilityBundle.contextContributors` + `PluginManager` 收集 + `mergeBundles` 汇聚。
- `AgentLoop`：run 前收集所有 contributor，文本注入 system prompt，工具本轮临时注册（run 结束还原），单个失败隔离（best-effort）。

## Capabilities

### New Capabilities

<!-- 无新能力目录。 -->

### Modified Capabilities

- `context-assembly`: 新增「ContextContributor 统一扩展缝」需求。
- `plugins`: `PluginContext` 新增 `registerContextContributor`。

## Impact

- 新增 `core/src/context/context-contributor.ts`；修改 `context/index.ts`、`plugins/{types,manager}.ts`、`capability/{types,bundle}.ts`、`agent/{types,loop,assemble}.ts`。
- 测试：新增 contributor 文本注入 / 工具临时注册还原 / 失败隔离。
- **非破坏**：纯新增缝；旧能力（rules/skills/docs/memory）仍走旧路径，行为不变。
