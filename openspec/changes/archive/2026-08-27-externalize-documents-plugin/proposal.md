## Why

documents / RAG 能力仍以 core 一等公民存在：`DocumentIndex`、归一化器（text/html/pdf/docx/epub）、分块器、`loadDocuments` 都在 `core/src/documents/`，且 `ContextComposer` 硬编码 `documentIndex` 检索注入 `[文档]`。这违背「能力外放、core 只留协议 + 引擎」。

本 change 把 documents 外放为 `@lhx-agent-engine/plugin-documents`，走 `ContextContributor` 统一缝（检索命中注入 `[文档]` 文本），core 删除 documents 硬路径。与 `plugin-rules` / `plugin-skills` 对称。

## What Changes

- **新增 `@lhx-agent-engine/plugin-documents`**：迁入 `DocumentIndex` + 归一化器 + 分块器 + `loadDocuments`；新增 `createDocumentsPlugin(documents, options?)`（`install` 装载文档 + 注册 `ContextContributor` 检索注入 `[文档]`）。
- **core 删 documents**：删 `documents/` 目录；`ContextComposer` 去掉 `documentIndex`；`AgentLoop`/`assemble`/`resolve` 去掉 document 路径。
- **config 零迁移（D1-A）**：`config.documents` 字段不变，解释权移交 `@lhx-agent-engine/plugin-documents`。

## Capabilities

### New Capabilities

- `plugin-documents`: `@lhx-agent-engine/plugin-documents` 提供 `createDocumentsPlugin` + `DocumentIndex` + `loadDocuments` + 归一化器/分块器。

### Modified Capabilities

- `documents`: 移除全部能力需求（归一化/分块/索引装载/二进制归一化/混合检索），迁至 `plugin-documents`。

## Impact

- 新增 `packages/plugins/plugin-documents/`（package.json / tsconfig / tsdown / src / tests / fixtures / README）。
- 修改 `packages/core/src/{documents/*（删）,agent/{loop,assemble,types}.ts,context/context-composer.ts,resolve/resolve.ts,index.ts,types.ts,tsdown.config.ts,package.json}`。
- 迁移 `packages/core/tests/{documents,binary-normalizers,document-semantic-recall}.test.ts`。
- 兼容性：`config.documents` 字段不变。
