## Why

文档摄入目前只覆盖 text/md 与 HTML，`loadDocuments` 遇到 `.pdf`/`.docx`/`.epub` 会被「未知扩展名跳过」。真实「大量文档」场景里，这三类是高频来源。补齐二进制文档归一化器，让 PDF/docx/epub 也落到「归一化 → Markdown → 分块 → 检索」的统一管线。

## What Changes

- `core/src/documents/`：新增 `PdfNormalizer`（`unpdf` 抽文本）、`DocxNormalizer`（`mammoth` → HTML → `turndown` 转 Markdown）、`EpubNormalizer`（`epub2` 解析章节 → `turndown` 转 Markdown）。
- `document-index.ts`：`loadDocuments` 注册三个新归一化器，按扩展名分派。
- 依赖：新增 `unpdf` / `mammoth` / `epub2`（三者均含类型声明，复用官方/成熟库，不自研解析器）。

## Capabilities

### New Capabilities

<!-- 无新能力目录，documents 已存在。 -->

### Modified Capabilities

- `documents`: 新增 PDF / docx / epub 归一化器与装载分派。

## Impact

- 修改 `core/src/documents/{pdf-normalizer,docx-normalizer,epub-normalizer,html-to-markdown,index,document-index}.ts`、`core/package.json`、`cspell.json`。
- 测试：新增二进制 fixtures（pdf/docx/epub）+ 归一化器单测 + `loadDocuments` 扩展名分派。
- **非破坏**：纯新增归一化器，text/html 行为不变。
