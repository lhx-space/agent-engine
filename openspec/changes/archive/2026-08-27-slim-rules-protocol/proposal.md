## Why

上一轮把 rules 外放成 `@lhx-agent-engine/plugin-rules`，但它仍依赖 core 的 `CapabilityLoader`（能力检索的「具体实现」），且 core 的 `buildSystemPrompt` 还残留 `rulesText` / `{{rules}}` 占位符——这是「能力实现」未彻底外放、协议未收敛的尾巴。

本 change 落实 D3 检索协议：`plugin-rules` 自建索引（MiniSearch + 可选 `InMemoryVectorStore`），检索编排复用 core 的 `hybridRetrieve`，摆脱 `CapabilityLoader`；同时清掉 `buildSystemPrompt` 的 `rulesText` 残留（规则注入已走 `ContextContributor`）。

## What Changes

- **`plugin-rules` 协议重构**：`loadRulesText` 改为纯函数 `(rules, onDemand)`（always 全量 + 命中的 on-demand 去重拼接）；新增内部 `RuleIndex`（MiniSearch + 可选向量库），`createRulesPlugin` 经 `hybridRetrieve` 检索，不再依赖 `CapabilityLoader`。
- **`plugin-rules` 依赖**：新增 `minisearch`。
- **core 清理**：`buildSystemPrompt` 移除 `rulesText` / `{{rules}}`（`BuildSystemPromptOptions.rulesText` 删除），规则注入统一由 `ContextContributor` 追加。
- **目录命名**：`packages/plugins/rules/` → `packages/plugins/plugin-rules/`。

## Capabilities

### Modified Capabilities

- `plugin-rules`: `loadRulesText` 签名改为 `(rules, onDemand)`；检索改为自建索引 + `hybridRetrieve`，不再依赖 `CapabilityLoader`。
- `context-assembly`: `buildSystemPrompt` 移除 `rulesText` / `{{rules}}` 占位符，只保留 `skillsText` / `{{skills}}`。

## Impact

- 修改 `packages/plugins/plugin-rules/{src/index.ts,tests/rules.test.ts,package.json,README*.md}`。
- 修改 `packages/core/src/context/{build-system-prompt.ts,types.ts}` 与 `packages/core/tests/context.test.ts`。
- 重命名 `packages/plugins/rules/` → `packages/plugins/plugin-rules/`。
- 兼容性：`config.rules` 字段不变；规则仍经 `ContextContributor` 注入 system prompt。
