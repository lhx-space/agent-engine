## Why

Phase 1 引入了 `ContextContributor` 统一扩展缝（插件经 `registerContextContributor` 注入「文本 + 临时工具」），但**旧能力仍走旧路径**：rules 的「匹配 meta → BM25/向量检索 → 注入 context」管线仍硬编码在 core（`rules/load.ts` 的 `loadRulesText` + `ContextComposer` 的 `ruleLoader` 分支 + `AgentLoop` 自建 `CapabilityLoader('rule')`）。这只做了「切面式」加缝，尚未真正把能力外放成插件包。

本 change 是 Phase 2 的第一个迁移（2a）：把 **rules 文本注入** 从 core 抽成独立插件包 `@lhx-agent-engine/plugin-rules`，删掉 core 的 rules 硬路径，走通「迁包 + 测试迁移 + 全量校验」的模板，为后续 skills / documents / memory / web / mcp 复制。

## What Changes

- **新增 `@lhx-agent-engine/plugin-rules` 包**：`createRulesPlugin(rules, options?)` 返回 `Plugin`，`install` 时注册一个 `ContextContributor`，每次 run 按 userInput 做「always 全注入 + on-demand BM25/向量 RRF 召回 top-k」并把规则文本注入 system prompt。`loadRulesText` 从 core 迁入本包（保持纯函数，可复用）。
- **core 删 rules 硬路径**：删除 `rules/load.ts`；`ContextComposer` 去掉 `rules` / `ruleLoader` / `rulesText`；`AgentLoop` 去掉 `rules` / `ruleLoader` 与 `new CapabilityLoader('rule')`。
- **core 删 rules 能力轴**：`PluginContext.registerRule`、`CapabilityBundle.rules`、`mergeBundles.rules`、装配层 `rule.loaded` 事件随之外放删除（context rule 概念统一收敛为 `registerContextContributor`）。
- **配置零迁移（D1-A）**：`config.rules` 字段与语义不变，解释权移交 `@lhx-agent-engine/plugin-rules`；server 在 `config.rules` 非空时自动装配该插件（经 `ResolveDeps.defaultPlugins`），用户 YAML 不改。
- **guardrail 不动**：`rules/registry.ts`（`RuleRegistry`）、`rules/declarative.ts`、`registerGuardrail`、`GuardrailRule` 属于「安全硬边界」，留在 core。

## Capabilities

### New Capabilities

- `plugin-rules`: `@lhx-agent-engine/plugin-rules` 提供 `createRulesPlugin(rules, options?)`，经 `ContextContributor` 注入规则文本；`loadRulesText` 迁入本包。

### Modified Capabilities

- `capability-retrieval`: 移除 core 的 `loadRulesText` 与「C1 空集合兜底」需求（迁至 `plugin-rules`）；`CapabilityLoader` / `CapabilityRegistry` / `hybridRetrieve` 仍留 core。
- `plugins`: `PluginContext` 移除 `registerRule`；`CapabilityBundle` 移除 `rules`；装配不再合并 rules。
- `events`: `AgentEngineEvent` 移除 `rule.loaded`（rules 加载由插件负责，不再由装配层发事件）。

## Impact

- 新增 `packages/plugins/rules/`（`package.json` / `tsconfig.json` / `tsdown.config.ts` / `src/index.ts` / `tests/rules.test.ts` / `README.md` / `README.zh-cn.md`）。
- 修改 `packages/core/src/rules/load.ts`（删除）、`rules/index.ts`、`context/context-composer.ts`、`agent/loop.ts`、`agent/types.ts`、`agent/assemble.ts`、`capability/types.ts`、`capability/bundle.ts`、`plugins/types.ts`、`plugins/manager.ts`、`events/types.ts`、`resolve/resolve.ts`、`resolve/types.ts`、`src/index.ts`。
- 修改 `packages/server/src/builtin-plugins.ts`、`packages/server/src/app.ts`、`packages/server/package.json`。
- 迁移 `packages/core/tests/{retrieval,capability-semantic-recall,context-composer,events,resolve}.test.ts`。
- 兼容性：`config.rules` 字段不变；`config.plugins` 无需显式声明 `@lhx-agent-engine/plugin-rules`（server 自动装配）。
