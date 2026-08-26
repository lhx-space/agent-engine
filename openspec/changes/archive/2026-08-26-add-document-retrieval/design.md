## Context

「归一化 → Markdown → 分块」已就位（`add-document-normalization`），下一步把文档接进「配置即 Agent」：声明 `documents` 配置，装配时装载 + 索引，run 时按 userInput 检索 top-k 注入 prompt。

## Goals / Non-Goals

**Goals:** `documents` 配置轴；`DocumentIndex`（BM25）+ `loadDocuments`；装配/run 接线；检索注入 `[文档]`。

**Non-Goals:** embedding/向量语义召回（后置）；glob 通配（v1 只支持文件/目录路径，目录递归）；PDF/docx/epub 适配器（后置）。

## Decisions

- **D1** `documents.sources` = 路径数组（文件或目录，目录 `readdir({ recursive: true })` 递归）；未知扩展名跳过。
- **D2** `DocumentIndex` 用 `MiniSearch` 索引 chunk 文本（复用 `segment` 中文分词，`retrieval/registry.ts` 导出），`retrieve(query, topK) → Chunk[]`。
- **D3** 检索注入走 `ContextComposer`：run 时 `documentIndex.retrieve(userInput, topK)` → 命中文本拼成 `[文档]` 片段（与 `[长期记忆]` 同级）追加进 system prompt。
- **D4** BM25 词法检索（无需 embedding）；`embedding`/`vectorStore` 语义升级留后续（可换 `Retriever` 或 `VectorStore.query`）。
- **D5** `loadDocuments` 在 `resolveAgentConfig` 阶段异步执行（读文件 + 归一化 + 分块），产物 `DocumentIndex` 经 assemble → AgentLoop → ContextComposer 注入。

## Risks / Trade-offs

- [目录递归] → `readdir` recursive 一次性枚举，v1 不做增量/热更新。
- [词法检索局限] → BM25 命中依赖词面重叠；语义召回靠后续 embedding 升级。

## Migration Plan

- 非破坏：`documents` 可选，缺省无文档；`segment` 由私有改导出（无行为变化）。
