## Why

「大量文档」场景需要文档摄入：把异构文档统一归一化为 Markdown，再切块，供后续（第二阶段）embedding + 向量化 + RAG 消费。当前 `EmbeddingProvider` / `VectorStore` / `SemanticMemory` 已就位，但缺「文档 → Markdown → chunk」这一段（`DocumentNormalizer` / `Chunker` 均不存在）。本 change 落地归一化层 + 分块层（**全模型无关**），config `documents` 轴与 embedding 接续留第二阶段。

## What Changes

- `core/src/documents/`：`Document` / `Chunk` 类型 + `DocumentNormalizer` / `Chunker` 接口。
- 归一化默认实现：`TextNormalizer`（text/md 透传）、`HtmlNormalizer`（`turndown` HTML→Markdown）。
- 分块默认实现：`FixedSizeChunker`（size + overlap）、`MarkdownHeadingChunker`（按标题切，超长回落固定切）。
- 导出：`@agent-engine/core/documents` 子路径 + 根 `index` / `types`。

## Capabilities

### New Capabilities

- `documents`: 文档归一化（→ Markdown）+ 分块（Chunker）。

## Impact

- 新增 `core/src/documents/{types,text-normalizer,html-normalizer,chunker,index}.ts`。
- 修改 `core/package.json`（依赖 `turndown` / subpath exports）、`core/tsdown.config.ts`、`core/src/{index,types}.ts`。
- 测试：Text/Html 归一化、FixedSize/MarkdownHeading 分块语义。
- **非破坏**：纯新增子路径与类型。
