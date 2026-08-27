## Context

长期记忆分「机制」与「实现」：机制（run 开始 recall 注入、结束 remember 写回）在 `AgentLoop`/`ContextComposer`，依赖 `LongTermMemory` 协议；实现是 `SemanticMemory`（组合 vectorStore + embedding + backend）。按协议层模式，core 留协议 + 机制，实现外放。

## Goals / Non-Goals

**Goals:**

- `SemanticMemory` 外放 `@agent-engine/plugin-memory`。
- core 留 `LongTermMemory` 接口 + `noopLongTermMemory` 默认。
- `assemble` 改为「注入 or no-op」。

**Non-Goals:**

- 不改 `LongTermMemory` 接口形状与 `AgentLoop` 的 recall/remember 机制。
- 不改 `MemoryBackend` / `VectorStore` / `EmbeddingProvider` 协议。
- 不在 Phase 2 解决装配（Phase 4 preset-default 用 `plugin-memory` 创建并注入）。

## Decisions

### D1: `assemble` 用「注入 or no-op」替代 `new SemanticMemory`

**选择**：`AssembleAgentLoopOptions.longTermMemory?: LongTermMemory`；`assemble` 里 `options.longTermMemory ?? noopLongTermMemory`。

**理由**：core 不再认识 `SemanticMemory`（能力实现），只认 `LongTermMemory` 协议。缺省 no-op（`name: 'none'`、remember 空、recall 空数组）与旧「无 embedding 时优雅 no-op」语义对齐；语义实现由组合层注入。

### D2: `SemanticMemory` 工厂随实现外放

**选择**：`plugin-memory` 导出 `SemanticMemory` 类与 `createSemanticMemory(vectorStore, embedding, backend)` 工厂。

**理由**：实现 + 工厂同包，组合层（Phase 4）拿到 vectorStore/embedding/memoryBackend 后调用工厂创建 `LongTermMemory`，再传给 `assemble`。core 零依赖。

## Risks / Trade-offs

- [语义记忆默认失效] 外放后 `assemble` 默认 no-op，语义长期记忆需组合层显式装配 `plugin-memory`（Phase 4）才生效。这是能力外放的过渡态，符合 plan。
- [时序] `SemanticMemory` 依赖 assemble 内解析出的 vectorStore/embedding/memoryBackend，无法在 plugin `install` 期创建；故用「工厂 + 注入」而非 `registerXxx` 协议。
