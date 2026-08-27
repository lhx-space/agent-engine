## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: 文档索引与装载

系统 SHALL 在 `loadDocuments` 遇到无适配器扩展名（如 `.bin`）时跳过该文件而不阻断整体装载；因 `.pdf` / `.docx` / `.epub` 已具备适配器，SHALL 不再将其视为「未知扩展名」。

#### Scenario: 未知扩展名跳过

- **WHEN** sources 含不支持扩展名（如 `.bin`）的文件
- **THEN** 该文件被跳过，不阻断整体装载
