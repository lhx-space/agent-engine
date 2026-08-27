# @agent-engine/plugin-memory

长期语义记忆：`SemanticMemory` 实现 core 的 `LongTermMemory` 协议（embedding 向量化 → 向量召回 → 持久化后端）。core 只保留 `LongTermMemory` 接口 + no-op 默认；本插件提供语义实现。

## 安装

```bash
pnpm add @agent-engine/plugin-memory
```

## 用法

```ts
import { createSemanticMemory } from '@agent-engine/plugin-memory';

const longTermMemory = createSemanticMemory(vectorStore, embeddingProvider, memoryBackend);

// 装配时传入 assembleAgentLoop({ longTermMemory })
```

## API

- `SemanticMemory` — 实现 `LongTermMemory`（`remember` / `recall`）；无 `EmbeddingProvider` 时 no-op。
- `createSemanticMemory(vectorStore, embedding, backend)` — 返回 `LongTermMemory` 的工厂。
