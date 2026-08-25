## Why

批 B 已立起 `MemoryBackend` / `VectorStore` / `EmbeddingProvider` 接口，但三层记忆③（语义层：embedding 向量化 + 向量召回 + 持久化）尚未消费——长期记忆仍是空壳。本 change 把它们接起来：跨会话把对话转成向量写入向量库 + 持久化到 `MemoryBackend`，query 进来时按语义召回注入上下文。

## What Changes

- `core/memory/long-term-memory.ts`：新增 `LongTermMemory` 接口 + `SemanticMemory` 默认（`embedding` 向量化 → `vectorStore.query` 召回 + `memoryBackend` 持久化；无 `embedding` 时优雅 no-op）。
- `AgentLoop`：`run` 开始时 `recall(userInput)` 召回相关长期记忆注入 system prompt；正常结束时把本轮（用户 + 最终答案）`remember` 写回。
- `assembleAgentLoop`：用已解析的 `vectorStore` + `embeddingProvider` + `memoryBackend` 构造 `SemanticMemory`，注入循环；随 `ResolvedAgent.longTermMemory` 暴露。

## Capabilities

### New Capabilities

<!-- 无新增能力目录：属 session-memory 既有长期记忆能力。 -->

### Modified Capabilities

- `session-memory`: 新增 `LongTermMemory` / `SemanticMemory`（语义召回 + 持久化）。
- `agent-loop`: `run` 长期记忆召回注入 + 正常结束写回。

## Impact

- 新增 `packages/core/src/memory/long-term-memory.ts`。
- 修改 `packages/core/src/memory/index.ts`、`packages/core/src/agent/{loop,assemble}.ts`、`packages/core/src/resolve/types.ts`、`packages/core/src/{index,types}.ts`。
- 测试：SemanticMemory 召回/持久化（mock embedding + InMemory 后端）/ 无 embedding no-op / resolve 装配。
- **非破坏**：无 `embedding` 配置时 `SemanticMemory` 静默不启用，行为不变。
