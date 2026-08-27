## Context

D3 已定「检索策略留 core、索引构建归插件」：能力包自建索引，复用 core 的 `hybridRetrieve`。但 `plugin-rules` 上一轮仍用 `CapabilityLoader`（core 里带闭合枚举 `CapabilityType` 的检索实现），这使 Phase 3 删 `CapabilityLoader` 前还要回头改 `plugin-rules`。本 change 提前把 `plugin-rules` 切到自建索引 + `hybridRetrieve`。

## Goals / Non-Goals

**Goals:**

- `plugin-rules` 自建 MiniSearch 索引（词法）+ 可选 `InMemoryVectorStore`（语义），检索编排复用 `hybridRetrieve`。
- `loadRulesText` 收敛为纯函数，不内嵌检索。
- core 清掉 `buildSystemPrompt` 的 `rulesText` / `{{rules}}` 残留。

**Non-Goals:**

- 不删 `CapabilityLoader` / `CapabilityRegistry` / `CapabilityType`（Phase 3 再删；本 change 只让 `plugin-rules` 不再依赖它们）。
- 不改 `{{skills}}` 占位符与 `skillsText`。
- 不改检索算法与 RRF 语义。

## Decisions

### D1: `plugin-rules` 自建索引 + `hybridRetrieve`

**选择**：`RuleIndex` 内部用 MiniSearch（`segment` 分词复用 Intl.Segmenter）建词法索引，可选 `InMemoryVectorStore` 做语义召回；检索调用 `hybridRetrieve(query, topK, { embedding, vectorStore, lexical, ensureVectors })`。

**理由**：索引构建归插件、检索编排复用 core 唯一实现（D3）。分词逻辑从 `CapabilityRegistry` 复制一份到插件（`segment` 未从 core 导出），是「能力自建索引」的应有代价；Phase 3 删 `CapabilityRegistry` 后这份词法索引逻辑留在插件侧，不再有重复。

### D2: `loadRulesText` 纯化

**选择**：`loadRulesText(rules: Rule[], onDemand: Rule[]): string`，只做「always 全量 + on-demand 去重拼接」，检索由调用方（`RuleIndex.retrieve`）完成。

**理由**：职责单一，便于测试与复用；不再让 `plugin-rules` 的公开 API 泄漏 `CapabilityLoader`。

### D3: `buildSystemPrompt` 去 `rulesText`

**选择**：删除 `BuildSystemPromptOptions.rulesText` 与 `{{rules}}` 变量/兜底追加逻辑。

**理由**：规则注入已外放为 `ContextContributor`（文本追加到 system prompt），`{{rules}}` 占位符失去消费者，属死代码；保留会误导「规则还在 core 组装」。

## Risks / Trade-offs

- [`{{rules}}` 模板占位符移除] 用户 systemPrompt 模板里若写了 `{{rules}}`，将不再被替换（规则改由 contributor 追加）。这是规则注入位置从「占位符」变为「追加」的语义迁移，符合 D2（统一缝）。
- [分词逻辑复制] `segment` 在 core（`CapabilityRegistry`）与 `plugin-rules` 各一份；Phase 3 删 core 那份后只剩插件侧，不构成长期重复。
