## Context

AGENTS.md 5.5 定义了「统一能力检索调度」：rules / skills / mcp tools / plugins 共享「meta + 按需加载」。首版以 rules 落地验证（content 为纯文本最简）。现有 `RuleSchema` 是 discriminatedUnion(static/guardrail)，需要修正为「meta + content」形态。

## Goals / Non-Goals

**Goals:**

- 修正 `RuleSchema` 为 `id` + `kind`(always/on-demand) + `description` + `content` + `tags`。
- 实现 `CapabilityRegistry`（统一 meta 注册）+ BM25 检索（minisearch + Intl.Segmenter）。
- rules 按需加载：always 全注入 + on-demand top-k 召回，输出「本次注入的规则文本」。
- C1 空集合兜底。

**Non-Goals:**

- 不实现 RRF 融合 / embedding / Reranker（依赖 M3 embedding）。
- 不实现记忆反馈 / 动态 k / 缓存（`CacheBackend` 抽象接口已在 AGENTS.md 预留，检索结果缓存留后续）。
- 不做 system-prompt 完整组装（模板 + 变量 + rules 拼接）——留 context 模块，本 change 只输出「规则文本」。
- 不接入 skills / mcp / plugins 的检索（先 rules 验证）。

## Decisions

### D1: 用 minisearch + Intl.Segmenter 分词

**选择**：`minisearch`（零依赖）+ Node 内置 `Intl.Segmenter`（中文 word 粒度分词）作为 tokenize。

**理由**：minisearch 零依赖、活跃、`search()` 返回 score；Intl.Segmenter 内置、中文分词效果好。符合「复用优先」。

**备选**：wink-bm25-text-search（严格 BM25）。缺点：拖入 wink-nlp 等 4 个重量级依赖。**否决**。

### D2: kind 改为 always / on-demand

**选择**：`kind: 'always' | 'on-demand'` 表达加载策略，替代原 static / guardrail。

**理由**：rules 的本质是「上下文约束」，加载策略（强制 / 按需）才是关键维度；原 static/guardrail 混淆了「加载方式」与「规则用途」。

### D3: tags 字段缓解召回漏检

**选择**：meta 增加 `tags: string[]`（同义词），参与检索索引，缓解 BM25 词面匹配漏检。

**理由**：BM25 是关键词匹配，用户表达与 description 用词差异大会漏检；tags 提供同义词补充（如 description「前端规范」配 tags「vue」「typescript」「组件」）。

### D4: 首版只输出「规则文本」，不做完整 prompt 组装

**选择**：`loadRulesForQuery(query)` 返回「注入的规则文本」，system-prompt 完整组装（模板 + 变量）留 context 模块。

**理由**：保持 change 聚焦，避免过早耦合 context 模块。

## Risks / Trade-offs

- [minisearch 非严格 BM25] → 其 TF-IDF 打分对 description 匹配场景等价，只需相关性排序 + 得分。
- [中文分词边界] → Intl.Segmenter word 粒度实测可切分「Vue3 / TypeScript / 编码」等；tags 兜底。
- [RuleSchema 变更影响] → 当前无消费方（rules-engine guardrail 独立，后续重新定位），无迁移负担。

## Migration Plan

`RuleSchema` 重构；`rules-engine`（上一 change 的 guardrail 代码拦截）独立保留，后续重新定位为「安全机制」，不与「可配置 rules」混淆。

## Open Questions

- 无（embedding 融合、重排、完整 prompt 组装均明确延后）。
