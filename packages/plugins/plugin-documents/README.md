# @agent-engine/plugin-documents

Document RAG plugin: on `install`, loads documents (enumerate sources → normalize → chunk → index) and registers a `ContextContributor` that retrieves matching chunks on every run and injects a `[文档]` block.

Includes `DocumentIndex` (BM25 + optional vector RRF via core's `hybridRetrieve`), normalizers (text / html / pdf / docx / epub) and chunkers (fixed-size / markdown-heading).

## Install

```bash
pnpm add @agent-engine/plugin-documents
```

## Usage

```ts
import { createDocumentsPlugin } from '@agent-engine/plugin-documents';

const documentsPlugin = createDocumentsPlugin(config.documents, {
  embedding: embeddingProvider, // optional; BM25-only when omitted
});

// 装配时传入 plugins: [documentsPlugin]
```

> In config, the `documents` slice is interpreted by this plugin (D1-A: field unchanged, zero migration).
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

- `createDocumentsPlugin(documents, options?)` — returns a `Plugin` that loads and registers a document `ContextContributor`.
- `loadDocuments(config, embedding?)` — loads documents into a `DocumentIndex`.
- `DocumentIndex` — BM25 + optional vector retrieval index.
- Normalizers / chunkers — `TextNormalizer` / `HtmlNormalizer` / `PdfNormalizer` / `DocxNormalizer` / `EpubNormalizer` / `FixedSizeChunker` / `MarkdownHeadingChunker`.
