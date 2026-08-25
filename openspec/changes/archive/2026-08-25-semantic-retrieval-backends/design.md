## Context

检索层目前只有 BM25（`CapabilityLoader`，`capability-retrieval`）。长期记忆语义召回（三层记忆③）与 BM25→embedding 融合（RRF，M3+）都依赖向量库与 embedding 抽象，但二者连接口都未定义（AGENTS.md §2.1 ⚠️ 清单）。本 change 延续「接口 + 默认 + 注入」模式立起这两块接口层，作为后续语义召回/RRF 的底座。

## Goals / Non-Goals

**Goals:**

- `VectorStore` 接口 + `InMemoryVectorStore` 默认（余弦相似度暴力召回，开发默认）。
- `EmbeddingProvider` 接口（`embed` 文本→向量 + `dimension`）；无默认实现（需真实向量模型）。
- 二者经 `PluginContext.registerVectorStore` / `registerEmbeddingProvider` 注入、`CapabilityBundle` 汇聚、`assembleAgentLoop` 解析、`ResolvedAgent` 暴露。

**Non-Goals:**

- 不做「embedding 模型配置」与「向量库配置选择」字段——那是多模型能力分离（`embedding` 配置）与后端选择，属后续 change。
- 不做语义召回的**消费逻辑**（三层记忆③ / RRF 融合检索）——本 change 只立接口层。
- 不做 pgvector / lanceDB 等生产向量库实现（用户/生态接入）。

## Decisions

### D1: `VectorStore` 定义在 `retrieval/`，`EmbeddingProvider` 定义在独立 `embedding/`

**选择**：`VectorStore` 放 `core/retrieval/vector-store.ts`（向量库服务于检索），`EmbeddingProvider` 放独立 `core/embedding/`（与 `llm/` 平行的模型能力抽象，兑现 AGENTS.md 7.3「embedding 是另一个抽象，不要塞进 LLMProvider」）。

**理由**：向量库是「检索的基础设施」，放 retrieval 语义内聚；embedding 是「模型能力」，与 LLM 平级、接口不同（文本→向量 vs 文本→文本），独立成模块避免误塞进 `LLMProvider`。

### D2: `VectorStore` 有 in-memory 默认，`EmbeddingProvider` 无默认

**选择**：`InMemoryVectorStore`（暴力余弦）作为开发默认；`EmbeddingProvider` 仅定义接口 + 注入点，无内置实现。

**理由**：向量存储可无外部依赖地「存 + 算余弦」，有合理默认；embedding 必须接真实向量模型（OpenAI embedding / 本地 embedding 服务），内核给不出无依赖的默认，故只定义接口、由用户/生态注入（与 `LLMProvider` 的 `providerFactory` 同理）。`embeddingProvider` 缺省为 `undefined`，上层据此禁用语义召回，优雅降级。

### D3: 语义检索后端经同一 `CapabilityBundle` 汇聚管道注入

**选择**：`PluginContext.registerVectorStore` / `registerEmbeddingProvider` 收进 `CapabilityBundle`（`vectorStores` / `embeddingProviders`），`mergeBundles` 汇聚；`assembleAgentLoop` 取首个注册的向量库 ?? `InMemoryVectorStore`、首个注册的 embedding ?? `undefined`，随 `ResolvedAgent` 暴露。

**理由**：与 `MemoryBackend`/`CacheBackend` 同一注入管道，不新开旁路；「取首个」语义简单（多后端按优先级取第一个注册的），与「同名后者覆盖」的按名选择不同——因为这两个抽象本次无配置名选择（留后续）。

## Risks / Trade-offs

- [接口先行、消费后置] → 与 MemoryBackend/CacheBackend 同理，本次「有接口 + 有默认/注入 + 可暴露」，语义召回消费逻辑 M3；底座先行避免「先造消费逻辑再抽接口」返工。
- [`InMemoryVectorStore` 暴力余弦 O(n)] → 仅开发默认，生产用 pgvector 等索引后端；接口无性能承诺。
- [embedding 无默认] → 缺省 `undefined`，上层需判空；这是「诚实表达不可用」而非报错，语义召回未启用时静默降级。

## Migration Plan

- 无配置字段变化，向后兼容。
- 语义召回（三层记忆③ / RRF）后续在 `ResolvedAgent.vectorStore` + `embeddingProvider` 之上实现；`embedding` 模型配置在「多模型能力分离」change 中落地。
