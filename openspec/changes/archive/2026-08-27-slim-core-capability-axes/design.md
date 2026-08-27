## Context

能力外放后，`CapabilityRegistry` / `CapabilityLoader` / `CapabilityType`（闭合枚举）与 `Bm25Retriever`（依赖 `CapabilityRegistry`）成为死代码——能力包已自建索引 + `hybridRetrieve`，不再注册「能力 meta」。删除它们让 core 的检索面收敛为「协议 + 原语」。

## Goals / Non-Goals

**Goals:**

- 删除 `CapabilityType` 闭合枚举、`CapabilityLoader`、`CapabilityRegistry`、`Bm25Retriever`。
- `Retriever` / `Reranker` 接口与 `hybridRetrieve` 保留；`Retriever` 默认实现改为 `noopRetriever`。
- 清理能力外放遗留的死依赖。

**Non-Goals:**

- 不改 `hybridRetrieve` / RRF / `VectorStore` / `EmbeddingProvider` 协议。
- 不做 D1-B（config 骨架化/插件注册子 schema）——当前 D1-A（字段保留、解释权移交）已满足，骨架化留待后续。

## Decisions

### D1: `Retriever` 默认实现从 `Bm25Retriever` 改为 `noopRetriever`

**选择**：删除 `Bm25Retriever`；`assemble` 用 `merged.retrievers[0] ?? noopRetriever`（`name: 'none'`，`retrieve` 返回空）。

**理由**：`Bm25Retriever` 的能力 meta 检索已无消费者；`Retriever` 接口保留为「自定义检索策略」注入点，缺省无策略（空候选）是诚实默认。`Reranker` 的 `IdentityReranker`（恒等）保留。

### D2: 分词逻辑随能力走，core 不再持有

**选择**：删除 `registry.ts` 里的 `segment`（中文分词）；能力包（rules/skills/documents）已各自自带 `segment`。

**理由**：`segment` 是「能力自建索引」的分词细节；core 只提供 `hybridRetrieve` 编排，不提供词法索引构建。

### D3: 死依赖清理

**选择**：core 移除 `minisearch` / `mammoth` / `epub2` / `turndown` / `unpdf` / `gray-matter` / `@mozilla/readability` / `linkedom`。

**理由**：这些仅被能力模块使用，能力外放后 core 无引用；保留是死依赖。

## Risks / Trade-offs

- [`ResolvedAgent.retriever.name` 变化] 从 `bm25` 变为 `none`（缺省无自定义检索时）。这是内部默认语义变化，非 config 字段变化。
