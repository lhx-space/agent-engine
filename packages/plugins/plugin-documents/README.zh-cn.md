# @lhx-agent-engine/plugin-documents

文档 RAG 插件：`install` 时装载文档（枚举 sources → 归一化 → 分块 → 索引），注册一个 `ContextContributor`，每次 run 检索命中 chunk 并注入 `[文档]` 文本块。

含 `DocumentIndex`（BM25 + 可选向量 RRF，复用 core 的 `hybridRetrieve`）、归一化器（text / html / pdf / docx / epub）与分块器（fixed-size / markdown-heading）。

## 安装

```bash
pnpm add @lhx-agent-engine/plugin-documents
```

## 用法

```ts
import { createDocumentsPlugin } from '@lhx-agent-engine/plugin-documents';

const documentsPlugin = createDocumentsPlugin(config.documents, {
  embedding: embeddingProvider, // 可选；不传时仅 BM25
});

// 装配时传入 plugins: [documentsPlugin]
```

> 配置里的 `documents` 切片由本插件解释（D1-A：字段不变、零迁移）。
>
> ```yaml
> documents:
>   sources: [./docs]
>   chunking:
>     strategy: heading
>     size: 1000
>   topK: 4
> ```

## API

- `createDocumentsPlugin(documents, options?)` — 返回装载文档并注册 contributor 的 `Plugin`。
- `loadDocuments(config, embedding?)` — 装载文档进 `DocumentIndex`。
- `DocumentIndex` — BM25 + 可选向量检索索引。
- 归一化器 / 分块器 — `TextNormalizer` / `HtmlNormalizer` / `PdfNormalizer` / `DocxNormalizer` / `EpubNormalizer` / `FixedSizeChunker` / `MarkdownHeadingChunker`。
