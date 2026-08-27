## Context

documents 与 rules / skills 同构：都是「数据 → 索引 → 检索 → 注入 context」。差异在 documents 的装载发生在装配期（`install` 里 async `loadDocuments`），且检索注入的是一段 `[文档]` 文本。documents 的索引（`DocumentIndex`）已经复用 core 的 `hybridRetrieve`，外放只需把 `segment` 分词复制进插件（能力自建索引，D3）。

## Goals / Non-Goals

**Goals:**

- documents 外放 `@agent-engine/plugin-documents`，走 `ContextContributor`（text 注入 `[文档]`）。
- core 删除 `documents/` 目录与 `documentIndex` 硬路径。
- 保留 `DocumentIndex` 的「BM25 + 可选向量 RRF」检索语义与二进制归一化能力。

**Non-Goals:**

- 不改检索算法、RRF、归一化器行为。
- 不删 `CapabilityLoader` / `CapabilityRegistry` / `CapabilityType`（Phase 3）。
- 不改 `config.documents` schema。

## Decisions

### D1: 装载发生在插件 `install`（async）

**选择**：`createDocumentsPlugin(documents, options?)` 的 `install` 里 `await loadDocuments(...)` 建索引，再 `registerContextContributor`。

**理由**：`Plugin.install` 已支持 async；装载失败（读文件/归一化抛错）会让 `PluginManager.install` 抛错 → 装配失败，与现状（`resolve` 里 `loadDocuments` 失败即抛错）一致。装载时机仍在装配期，行为不变。

### D2: 文档检索注入走 `ContextContributor` 文本通道

**选择**：contributor 检索命中 chunk 后返回 `{ text: '[文档]\n...' }`，不再经 `ContextComposer` 的 `documentIndex` 分支。

**理由**：与 rules/skills 注入统一；`ContextComposer` 彻底退化为「system prompt + 会话历史 + 长期记忆」的纯装载器。

### D3: 分词逻辑复制进插件

**选择**：`document-index.ts` 自实现 `segment`（Intl.Segmenter），不再 import core 内部 `retrieval/registry` 的 `segment`。

**理由**：core 未导出 `segment`；能力自建索引应自带分词（D3），与 `plugin-rules`/`plugin-skills` 一致。Phase 3 删 `CapabilityRegistry` 后，core 那份 `segment` 随之消失，插件侧这份是唯一实现。

## Risks / Trade-offs

- [文档装载资源] `DocumentIndex` 生命周期随插件实例；`install` 后无显式 dispose（索引为内存态，无外部连接），无需清理。
- [分词复制] `segment` 在 core（`CapabilityRegistry`）与 `plugin-documents` 各一份；Phase 3 删 core 那份后只剩插件侧。
