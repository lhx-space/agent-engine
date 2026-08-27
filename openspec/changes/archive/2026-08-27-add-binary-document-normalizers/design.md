## Context

「归一化层 md 后 在处理」——文档摄入先把异构文档统一成 Markdown，再走分块/检索。现有 `TextNormalizer` / `HtmlNormalizer` 已覆盖 text/md/html；PDF / docx / epub 是高频缺失。

## Goals / Non-Goals

**Goals:** 三个二进制归一化器（PDF/docx/epub），接入 `loadDocuments` 按扩展名分派，全部产出 Markdown。

**Non-Goals:** 扫描版 PDF 的 OCR（unpdf 只抽文本层）；docx 图片/复杂版式保真；epub 图片/样式；增量加载与热更新。

## Decisions

- **D1 复用成熟库，不自研解析器**：PDF 用 `unpdf`（服务端 pdf.js，抽文本层）；docx 用 `mammoth`（语义 HTML：Heading→h1 等）；epub 用 `epub2`（解析 spine/flow + `getChapterAsync` 取章节 HTML）。
- **D2 docx/epub 走 HTML→Markdown**：`mammoth.convertToHtml` 与 `epub2.getChapterAsync` 均产出 HTML，统一经 `turndown`（`headingStyle:'atx'`）转 Markdown，保留标题/列表结构，契合「归一化到 md」。
- **D3 PDF 产出纯文本**：`unpdf.extractText({ mergePages: true })` 直接得文本层（无结构），作为 Markdown 透传（与 `TextNormalizer` 同形态）。
- **D4 共享 `htmlToMarkdown` 工具**：抽 `html-to-markdown.ts` 单例，供 `HtmlNormalizer` / `DocxNormalizer` / `EpubNormalizer` 复用，避免三份 turndown 实例。
- **D5 epub 用 `input.path`**：`epub2` 需要真实文件路径（内部自行解包），故 `EpubNormalizer` 读 `NormalizeInput.path`（`loadDocuments` 已提供真实路径），其余归一化器用 `input.content`。

## Risks / Trade-offs

- [unpdf 文本层依赖] → 扫描版 PDF 无文本层时输出空/少，属预期（OCR 非本次范围）。
- [epub2 回调式旧库] → 用其 `createAsync` + `getChapterAsync` Promise 包装，规避回调；仅支持 UTF-8（其 README 明示）。
- [docx 版式取舍] → mammoth 产出「语义 HTML」而非像素级复刻，正合「归一化」目标。

## Migration Plan

- 非破坏：新增 normalizer，`loadDocuments` 的 `normalizers` 列表追加三个即可；未知扩展名仍跳过。
