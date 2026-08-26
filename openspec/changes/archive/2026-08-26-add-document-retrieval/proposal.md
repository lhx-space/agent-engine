## Why

文档「归一化 + 分块」已落地，但还没接进配置与运行链路。新增 `documents` 配置轴 + `DocumentIndex`（BM25 检索）+ 把命中片段注入 system prompt，让「大量文档」真正可被 Agent 检索消费。BM25 是词法检索，**无需 embedding**，embedding/向量语义召回后置。

## What Changes

- `config`：`documents` 配置轴（`sources` 路径数组 + `chunking` 策略 + `topK`）。
- `core/src/documents/`：`DocumentIndex`（MiniSearch 索引 chunk 文本 + `retrieve(query, topK)`）+ `loadDocuments`（目录/文件 → 归一化 → 分块 → 索引）。
- 接线：`resolveAgentConfig` 装配时 `loadDocuments` → `assembleAgentLoop` → `AgentLoop` → `ContextComposer`；run 时检索 top-k 注入 `[文档]` 片段。

## Capabilities

### New Capabilities

<!-- documents 能力目录已存在（归一化 + 分块），本次扩充检索。 -->

### Modified Capabilities

- `documents`: 新增 `DocumentIndex` + `loadDocuments`（检索）。
- `agent-config-schema`: 新增 `documents` 配置轴。
- `agent-loop`: 新增「文档检索注入」需求。

## Impact

- 修改 `config/src/schema/index.ts`、`core/src/documents/{document-index,index}.ts`、`core/src/retrieval/registry.ts`（导出 `segment`）、`core/src/resolve/resolve.ts`、`core/src/agent/{assemble,loop,types}.ts`、`core/src/context/{context-composer,types}.ts`。
- 测试：`loadDocuments` 装配 / `DocumentIndex.retrieve` 召回 / ContextComposer 注入 `[文档]`。
- **非破坏**：`documents` 配置轴为可选新增，缺省无文档。
