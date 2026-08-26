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
