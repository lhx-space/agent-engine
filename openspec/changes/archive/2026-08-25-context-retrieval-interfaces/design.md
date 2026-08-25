## Context

三层记忆①②（token 预算裁剪 + 滚动摘要）与 RRF 融合召回需要可插拔的 `TokenCounter` / `ContextCompactor` / `Retriever` / `Reranker`，但当前 `ConversationMemory` 按条数裁剪、`CapabilityLoader` 写死 BM25，无接口承接。本 change 立起四接口（沿用「接口 + 默认 + 注入 + 暴露」，消费逻辑 M3）。

## Goals / Non-Goals

**Goals:**

- 四个接口 + 默认实现 + 插件注入 + `ResolvedAgent` 暴露。

**Non-Goals:**

- 不把 `TokenBudgetCompactor` 接进 `ConversationMemory` 替换条数裁剪（三层记忆①②消费逻辑，M3）。
- 不把 `Retriever`/`Reranker` 接进 `AgentLoop` 替换 `CapabilityLoader`（RRF 融合消费，M3）。
- 不做真实 tokenizer（tiktoken）依赖——默认用粗估，精确 tokenizer 由用户插件接入。

## Decisions

### D1: `TokenCounter` 默认用「字符/4」粗估，不引 tiktoken

**选择**：`ApproximateTokenCounter.count = ceil(len/4)`；精确 tokenizer（tiktoken/gpt-tokenizer）由用户实现 `TokenCounter` 经插件注入。

**理由**：无依赖的粗估诚实可用；精确计数是模型相关、需引重依赖，留给生态。接口允许替换，语义清晰。

### D2: `ContextCompactor.compact(messages, budgetTokens)` 按「整轮」从头部淘汰

**选择**：默认 `TokenBudgetCompactor` 从尾部往前按 `user` 起点切整轮、累计 token，超预算即停，保留最近整轮（若单轮超预算则至少保留最后一轮）。

**理由**：整轮边界（user 起点）保证不拆散 assistant `tool_call` 与 tool 结果配对，直接兑现三层记忆①的「绝不拆散配对」；token 预算替代条数，粒度可控。

### D3: `Retriever`/`Reranker` 用通用候选形状，默认 BM25 / 恒等

**选择**：`RetrievalCandidate = { id, score, payload? }`；`Bm25Retriever` 复用 `CapabilityRegistry`；`IdentityReranker` 保持原序原分。二者异步接口（`Promise`），为未来向量/RRF（异步）预留。

**理由**：候选形状通用（不绑死 `CapabilityMeta`），payload 由调用方收窄；异步签名承接 embedding/向量召回；BM25 默认复用现有 `CapabilityRegistry`，不重复造轮子。

## Risks / Trade-offs

- [粗估 token 不精确] → 默认仅用于预算粗控；生产接 tiktoken 插件，接口可替换。
- [接口先行、消费后置] → 与 MemoryBackend 等同理，四接口本次不接进循环；M3 消费逻辑在其上实现。
- [`TokenBudgetCompactor` 单轮超预算] → 至少保留最后一轮（best effort），不丢当前上下文。

## Migration Plan

- 无配置字段变化，向后兼容。
- M3：`ConversationMemory` 接 `ContextCompactor`（token 预算 + 整轮），`AgentLoop` 接 `Retriever`/`Reranker`（RRF 融合）。
