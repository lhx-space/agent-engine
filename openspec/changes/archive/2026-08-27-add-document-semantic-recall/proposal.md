## Why

文档检索目前只有 BM25 词法召回，命中依赖词面重叠；语义相关但用词不同的查询会漏召回。`embedding` 配置轴与 `EmbeddingProvider` 已存在（长期记忆在用），把文档检索升级为「BM25 + 向量」混合召回（RRF 融合），让「大量文档」场景既有词法精确、又有语义覆盖。

## What Changes

- `core/src/retrieval/rrf.ts`：新增 `reciprocalRankFusion`（RRF 通用原语，多路排名融合）。
- `core/src/documents/document-index.ts`：`DocumentIndex` 支持可选 `embedding` + `vectorStore`；`addChunks` 向量化入库，`retrieve` 做 BM25 + 向量 RRF 融合（签名转 async）。
- `loadDocuments(config, embedding?)` 与 `resolveAgentConfig` 接线：装配时把 `embedding` 配置解析出的 provider 传入 `loadDocuments`。
- `ContextComposer`：`await documentIndex.retrieve(...)`。

## Capabilities

### New Capabilities

<!-- 无新能力目录。 -->

### Modified Capabilities

- `documents`: 新增「文档混合检索（BM25 + 向量 RRF 融合）」需求。

## Impact

- 修改 `core/src/retrieval/{rrf,index}.ts`、`core/src/documents/document-index.ts`、`core/src/resolve/resolve.ts`、`core/src/context/context-composer.ts`。
- 测试：`DocumentIndex.retrieve` 签名改 async 需同步更新；新增 RRF 单测 + 混合召回单测。
- **非破坏（功能）**：无 `embedding` 时仍为 BM25 词法检索，行为一致；**签名破坏**：`DocumentIndex.addChunks/retrieve` 由同步转 async（v0.1 内部 API）。
