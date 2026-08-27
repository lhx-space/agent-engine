## ADDED Requirements

### Requirement: 统一混合检索原语

系统 SHALL 提供 `hybridRetrieve(query, topK, { embedding, vectorStore, lexical, ensureVectors? })`，作为「词法（BM25）+ 语义（向量）双路召回 → RRF 融合」的唯一实现；语义链路任一步失败时 SHALL 回落词法召回结果。`CapabilityRegistry.retrieve` 与 `DocumentIndex.retrieve` SHALL 委托该原语，各自只提供词法召回回调与结果映射。

#### Scenario: 双路召回与融合

- **WHEN** 以提供 `embedding` + `vectorStore` + `lexical` 回调调用 `hybridRetrieve`
- **THEN** 词法与向量双路召回，RRF 融合后返回 top-k 候选（含 `score`）

#### Scenario: 语义链路失败回落词法

- **WHEN** embedding 调用抛错
- **THEN** `hybridRetrieve` 返回 `lexical(query, topK)` 的候选而不抛错
