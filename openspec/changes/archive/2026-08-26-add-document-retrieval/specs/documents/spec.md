## ADDED Requirements

### Requirement: 文档索引与装载

系统 SHALL 提供 `DocumentIndex`（`addChunks` + `retrieve(query, topK) → Chunk[]`，MiniSearch 索引 chunk 文本）与 `loadDocuments(config)`（枚举 sources 目录/文件 → 按扩展名归一化 → 分块 → 索引；未知扩展名跳过）。

#### Scenario: 装载并召回

- **WHEN** `loadDocuments` 装载含「天气」文本的目录后 `retrieve('天气', 1)`
- **THEN** 返回含「天气」的 chunk

#### Scenario: 未知扩展名跳过

- **WHEN** sources 含不支持扩展名（如 `.pdf`，v1 无适配器）的文件
- **THEN** 该文件被跳过，不阻断整体装载
