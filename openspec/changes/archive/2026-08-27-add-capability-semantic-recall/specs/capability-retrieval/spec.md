## ADDED Requirements

### Requirement: 能力检索语义化（BM25 + 向量 RRF 融合）

系统 SHALL 使 `CapabilityRegistry` 支持可选 `embedding` 与 `vectorStore`：提供 `embedding` 时，`retrieve(query, topK)` SHALL 并行执行 BM25 词法召回与向量语义召回（嵌入面为 `description` + `tags`），经 `reciprocalRankFusion` 融合后返回 top-k 候选（含 `score`）；未提供 `embedding` 或语义链路失败时 SHALL 回落为纯 BM25。

#### Scenario: 无 embedding 回落 BM25

- **WHEN** `CapabilityRegistry` 未提供 `embedding` 时 `retrieve(query)`
- **THEN** 返回 BM25 词法召回结果

#### Scenario: 有 embedding 时语义召回补漏

- **WHEN** `CapabilityRegistry` 提供 `embedding` 且 query 与某 meta 用词不同但语义相关
- **THEN** 该 meta 经向量召回 + RRF 融合后被召回

#### Scenario: 语义链路失败优雅回落

- **WHEN** embedding 调用抛错
- **THEN** `retrieve` 返回 BM25 召回结果而不抛错

## MODIFIED Requirements

### Requirement: BM25 检索

系统 SHALL 提供 `retrieve(query, topK)`（异步），用 minisearch + Intl.Segmenter 分词对 meta（description + tags）打分，返回 top-k 候选（含 `score`）；提供 `embedding` 时融合向量语义召回。

#### Scenario: 关键词召回

- **WHEN** 以「Vue 组件怎么写」检索，存在 description 含「Vue3 TypeScript 编码规范」的 rule
- **THEN** 该 rule 被召回且 score 较高

#### Scenario: 输出得分

- **WHEN** 检索返回候选
- **THEN** 每项含 `score`，可用于可观测排查
