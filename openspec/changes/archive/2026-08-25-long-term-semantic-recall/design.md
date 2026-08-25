## Context

三层记忆③（语义层）要把批 B 的 `MemoryBackend` / `VectorStore` / `EmbeddingProvider` 消费起来：跨会话长期记忆 = embedding 向量化 + 向量召回 + 持久化。此前三接口仅「定义 + 暴露」，无消费逻辑。

## Goals / Non-Goals

**Goals:**

- `LongTermMemory` 接口 + `SemanticMemory` 默认（消费三接口）。
- 循环 `recall` 注入 + `remember` 写回。

**Non-Goals:**

- 不做记忆去重 / 遗忘 / 重要性打分——首版「每轮都记」最简。
- 不做 RRF 融合召回（BM25 + 向量）——`Retriever`/`Reranker` 已留接口，后续。
- 不做记忆的会话隔离 schema——`SemanticMemory` 用唯一 id 写入，隔离策略属上层。

## Decisions

### D1: 无 embedding 时优雅 no-op，不做显式开关

**选择**：`SemanticMemory` 未注入 `EmbeddingProvider` 时 `remember`/`recall` 直接返回（不抛错）；不新增 `memory.longTerm.semantic` 开关。

**理由**：embedding 是需要真实模型的可选能力，缺省即「语义记忆未启用」；显式开关是冗余配置。接口边界已在 `ResolvedAgent.embeddingProvider` 表达。

### D2: 注入点为 system prompt 的 `[长期记忆]` 片段

**选择**：召回文本作为 `\n\n[长期记忆]\n...` 追加到 system prompt 之后。

**理由**：长期记忆是跨会话「知识」，与 rules/skills 同类（约束/背景），归入 system prompt 而非历史消息；不破坏历史 user/assistant 配对。

### D3: 每轮正常结束写回一条（用户输入 + 最终答案）

**选择**：`remember` 记录「用户输入 + 最终 assistant 答案」拼接文本；异常不写回。

**理由**：以「轮」为记忆粒度，避免把中间 tool_call 噪声写进长期记忆；异常不写回与 `ConversationMemory` 同语义。

## Risks / Trade-offs

- [每轮都记 → 记忆膨胀] → Non-Goal；去重/遗忘留后续。
- [无 embedding 时静默 no-op，可能被误以为失效] → 文档与 spec 明确；`ResolvedAgent.embeddingProvider` 为 undefined 即可判断。
- [召回注入 token 消耗] → topK 默认小（3），后续可配置。

## Migration Plan

- 无破坏：无 embedding 时行为不变。
- 后续：RRF 融合、记忆去重/遗忘、topK 配置轴。
