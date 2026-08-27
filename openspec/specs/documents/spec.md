# documents Specification

## Purpose

TBD - created by archiving change add-document-normalization. Update Purpose after archive.

## Requirements

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

系统 SHALL 提供 `DocumentIndex`（`addChunks` + `retrieve(query, topK) → Promise<Chunk[]>`）与 `loadDocuments(config, embedding?)`；`DocumentIndex` SHALL 按可选 `embedding` 决定「纯 BM25」或「BM25 + 向量 RRF 混合」召回。`addChunks` 与 `retrieve` SHALL 为异步签名。`loadDocuments` SHALL 在遇到无适配器扩展名（如 `.bin`）时跳过该文件而不阻断整体装载。

#### Scenario: 装载并召回

- **WHEN** `loadDocuments` 装载含「天气」文本的目录后 `await index.retrieve('天气', 1)`
- **THEN** 返回含「天气」的 chunk

#### Scenario: 未知扩展名跳过

- **WHEN** sources 含不支持扩展名（如 `.bin`）的文件
- **THEN** 该文件被跳过，不阻断整体装载

### Requirement: 二进制文档归一化器

系统 SHALL 提供 PDF / docx / epub 归一化器，产出 `Document.markdown`：`PdfNormalizer`（`unpdf` 抽取文本层，extensions 含 `pdf`）、`DocxNormalizer`（`mammoth` → HTML → `turndown` 转 Markdown，extensions 含 `docx`）、`EpubNormalizer`（`epub2` 解析章节 HTML → `turndown` 转 Markdown，extensions 含 `epub`）。`loadDocuments` SHALL 按扩展名分派到这些归一化器。

#### Scenario: PDF 抽取文本层

- **WHEN** 用 `PdfNormalizer` 归一化一个含文本层的 PDF
- **THEN** `Document.markdown` 含 PDF 文本层内容

#### Scenario: docx 归一化为 Markdown

- **WHEN** 用 `DocxNormalizer` 归一化含标题与正文的 docx
- **THEN** `Document.markdown` 为 Markdown，标题转为 `#` 形态、正文保留

#### Scenario: epub 归一化为 Markdown

- **WHEN** 用 `EpubNormalizer` 归一化一个 epub
- **THEN** `Document.markdown` 含章节正文，`loadDocuments` 可装载该 epub

#### Scenario: loadDocuments 分派二进制扩展名

- **WHEN** `loadDocuments` 装载含 `.pdf` / `.docx` / `.epub` 的目录
- **THEN** 三者均被归一化并索引，不再因「未知扩展名」被跳过

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
