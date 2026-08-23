## Why

统一能力检索调度（AGENTS.md 5.5）需要在 M2 落地首版。当 rules 数量增多（几十上百条），全量注入 system prompt 会导致 token 爆炸与 LLM 注意力分散。需要 BM25 检索：user input 进来后对 rules 的 meta（description）打分，只召回 top-k 相关规则，让 LLM 在有限范围内理解。

同时，现有 `RuleSchema`（discriminatedUnion：static / guardrail）的语义需要修正——rules 的正确形态是「meta（id / kind / description）+ content（markdown 正文）」，按 `kind`（always / on-demand）决定加载策略，而非「static / guardrail」的类型划分。

## What Changes

- **修正 `RuleSchema`**：`id` + `kind`（always / on-demand）+ `description`（匹配面）+ `content`（markdown 正文）+ `tags`（同义词）。
- **实现 `CapabilityRegistry`**：统一 meta 注册（id / type / description / tags）。
- **实现 BM25 检索**：`minisearch` + `Intl.Segmenter` 中文分词，返回 top-k（含 score）。
- **rules 按需加载**：`always` 规则 content 全注入 + `on-demand` 规则 BM25 召回 top-k 的 content，输出「本次注入的规则文本」。
- **C1 空集合兜底**：无候选时返回空（不注入规则）。

## Capabilities

### New Capabilities

- `capability-retrieval`: `CapabilityRegistry` 统一 meta、BM25 检索（minisearch + Intl.Segmenter）、rules 按需加载（always / on-demand + C1 兜底）。

### Modified Capabilities

- `agent-config-schema`: `RuleSchema` 从 `discriminatedUnion(static/guardrail)` 改为 `id + kind(always/on-demand) + description + content + tags`。

## Impact

- 修改 `packages/config/src/schema/index.ts`（RuleSchema 及关联类型）。
- 新增 `packages/core/src/retrieval/`（CapabilityRegistry + BM25 检索器）与 `packages/core/src/rules/loader.ts`（rules 按需加载）。
- 依赖：`minisearch`（零依赖库）。
- 无 breaking changes（RuleSchema 尚无消费方；rules-engine 的 guardrail 实现独立，后续重新定位）。
