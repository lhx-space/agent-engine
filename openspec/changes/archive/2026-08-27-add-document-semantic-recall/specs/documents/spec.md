## ADDED Requirements

### Requirement: 文档混合检索（BM25 + 向量 RRF 融合）

系统 SHALL 提供 RRF 融合原语 `reciprocalRankFusion(lists, k)`，把多路已排名候选合并为单一排名。`DocumentIndex` SHALL 支持可选 `embedding` 与 `vectorStore`：提供 `embedding` 时，`addChunks` SHALL 向量化每个 chunk 并写入 `vectorStore`，`retrieve(query, topK)` SHALL 并行执行 BM25 词法召回与向量语义召回，经 RRF 融合后返回 top-k chunk；未提供 `embedding` 时 SHALL 回落为纯 BM25。

#### Scenario: 无 embedding 回落 BM25

- **WHEN** `DocumentIndex` 未提供 `embedding` 时 `retrieve(query)`
- **THEN** 返回 BM25 词法召回结果

#### Scenario: 有 embedding 时语义召回补漏

- **WHEN** `DocumentIndex` 提供 `embedding` 且 query 与 chunk 用词不同但语义相关
- **THEN** 相关 chunk 经向量召回 + RRF 融合后被召回

#### Scenario: RRF 融合去重合并

- **WHEN** 同一 chunk 同时出现在 BM25 与向量两路候选
- **THEN** RRF 融合后仅保留一条，得分按两路排名加权

## MODIFIED Requirements

### Requirement: 文档索引与装载

系统 SHALL 提供 `DocumentIndex`（`addChunks` + `retrieve(query, topK) → Promise<Chunk[]>`）与 `loadDocuments(config, embedding?)`；`DocumentIndex` SHALL 按可选 `embedding` 决定「纯 BM25」或「BM25 + 向量 RRF 混合」召回。`addChunks` 与 `retrieve` SHALL 为异步签名。

#### Scenario: 装载并召回

- **WHEN** `loadDocuments` 装载含「天气」文本的目录后 `await index.retrieve('天气', 1)`
- **THEN** 返回含「天气」的 chunk
