## Context

用户定调：文档摄入先「归一化成 Markdown，再处理」。归一化层隔离格式差异，下游（chunk / embed / RAG）只认 Markdown 一种形态，且 Markdown 保留标题/列表结构，利于语义分块与 LLM 阅读。

## Goals / Non-Goals

**Goals:** `DocumentNormalizer` / `Chunker` 接口 + 默认实现（text/md、html；FixedSize、MarkdownHeading）；导出 + 测试；全模型无关。

**Non-Goals:** config `documents` 轴（第二阶段）；embedding/向量化接续（第二阶段）；PDF/docx/epub 解析（二进制 fixture + 重依赖，后置）；PluginContext 注入点（等 config 轴消费时再加）。

## Decisions

- **D1** 归一化层输出统一为 **Markdown**（`Document.markdown`），下游只认 md。
- **D2** `normalize` 为 `Promise<Document>`（未来 PDF 等解析是异步）。
- **D3** v1 归一化实现：`TextNormalizer`（透传）、`HtmlNormalizer`（`turndown`，HTML→Markdown）；PDF 用 `unpdf`、docx 用 `mammoth`、epub 用 `epub2` 后置为 adapter。
- **D4** chunker 两种：`FixedSizeChunker`（按 size + overlap，尽量在换行边界切）、`MarkdownHeadingChunker`（按 `#` 标题切段，单段超 size 回落固定切）。
- **D5** 纯库层（不接 config 轴 / 注入点 / embedding），保持可单测、无副作用。

## Risks / Trade-offs

- [turndown 为 CJS] → 与 `gray-matter`/`minisearch` 同款 default import（esModuleInterop 已开）。
- [结构保真 vs 复杂度] → v1 只做 FixedSize + Heading 两种，语义/向量分块留到接 embedding 时。

## Migration Plan

- 非破坏：新增子路径与类型，不改现有模块。
