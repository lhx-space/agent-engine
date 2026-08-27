# plugin-documents Specification

## Purpose

TBD - created by archiving change externalize-documents-plugin. Update Purpose after archive.

## Requirements

### Requirement: createDocumentsPlugin 装载并注册 ContextContributor

系统 SHALL 提供 `@agent-engine/plugin-documents` 包，导出 `createDocumentsPlugin(documents, options?)`，返回 `Plugin`；其 `install(ctx)` SHALL 装载文档（枚举 sources → 归一化 → 分块 → 索引）后调用 `ctx.registerContextContributor` 注册一个 `ContextContributor`（`name` 为 `@agent-engine/plugin-documents`），每次 run 检索命中 chunk 并注入 `[文档]` 文本。

#### Scenario: 装载并注入 [文档]

- **WHEN** 以一个含 Markdown 文件的 `documents` 配置安装插件并运行
- **THEN** 检索命中的 chunk 文本经 `ContextContributor` 注入，含 `[文档]` 标记

### Requirement: 文档归一化层

系统 SHALL 提供 `DocumentNormalizer` 接口（`name` + `extensions` + `normalize(input) → Promise<Document>`），将异构文档归一化为 Markdown（`Document.markdown`）；默认实现 SHALL 含 `TextNormalizer`（text/md 透传）与 `HtmlNormalizer`（`turndown` HTML→Markdown）。

#### Scenario: text/md 透传

- **WHEN** 用 `TextNormalizer` 归一化文本内容
- **THEN** `Document.markdown` 为原文本，`path` 透传

#### Scenario: HTML 归一化为 Markdown

- **WHEN** 用 `HtmlNormalizer` 归一化 `<h1>标题</h1><p>正文</p>`
- **THEN** `Document.markdown` 为 `# 标题\n\n正文`

### Requirement: 分块

系统 SHALL 提供 `Chunker` 接口（`chunk(markdown) → Chunk[]`）；默认实现 SHALL 含 `FixedSizeChunker`（size + overlap，尽量在换行边界切）与 `MarkdownHeadingChunker`（按 `#` 标题切段，单段超 size 回落固定切）。

#### Scenario: 固定大小分块

- **WHEN** 用 `FixedSizeChunker({ size, overlap })` 分块
- **THEN** 产出多个 `Chunk`，长度不超过 size（重叠部分除外）

#### Scenario: 按标题分块

- **WHEN** 用 `MarkdownHeadingChunker` 分块含多个 `#` 标题的 Markdown
- **THEN** 每个标题及其正文成为一个 `Chunk`，`metadata` 含标题

### Requirement: 文档索引与装载

系统 SHALL 提供 `DocumentIndex`（`addChunks` + `retrieve(query, topK) → Promise<Chunk[]>`）与 `loadDocuments(config, embedding?)`；`DocumentIndex` SHALL 按可选 `embedding` 决定「纯 BM25」或「BM25 + 向量 RRF 混合」召回。`loadDocuments` SHALL 在遇到无适配器扩展名时跳过该文件而不阻断整体装载。

#### Scenario: 装载并召回

- **WHEN** `loadDocuments` 装载含「天气」文本的目录后 `retrieve('天气', 1)`
- **THEN** 返回含「天气」的 chunk

#### Scenario: 未知扩展名跳过

- **WHEN** sources 含不支持扩展名的文件
- **THEN** 该文件被跳过，不阻断整体装载

### Requirement: 二进制文档归一化器

系统 SHALL 提供 PDF / docx / epub 归一化器：`PdfNormalizer`（`unpdf`，extensions 含 `pdf`）、`DocxNormalizer`（`mammoth` → HTML → `turndown`，extensions 含 `docx`）、`EpubNormalizer`（`epub2`，extensions 含 `epub`）。`loadDocuments` SHALL 按扩展名分派。

#### Scenario: PDF / docx / epub 归一化

- **WHEN** 分别用 `PdfNormalizer` / `DocxNormalizer` / `EpubNormalizer` 归一化对应文件
- **THEN** `Document.markdown` 含其文本内容，`loadDocuments` 可装载并索引

### Requirement: 文档混合检索（BM25 + 向量 RRF 融合）

`DocumentIndex` SHALL 支持可选 `embedding` 与 `vectorStore`：提供 `embedding` 时，`addChunks` SHALL 向量化每个 chunk 并写入 `vectorStore`，`retrieve(query, topK)` SHALL 经 RRF 融合 BM25 词法召回与向量语义召回；未提供 `embedding` 时 SHALL 回落纯 BM25。

#### Scenario: 无 embedding 回落 BM25

- **WHEN** `DocumentIndex` 未提供 `embedding` 时 `retrieve(query)`
- **THEN** 返回 BM25 词法召回结果

#### Scenario: 有 embedding 语义召回补漏

- **WHEN** `DocumentIndex` 提供 `embedding` 且 query 与 chunk 用词不同但语义相关
- **THEN** 相关 chunk 经向量召回 + RRF 融合后被召回
