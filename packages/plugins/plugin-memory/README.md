# @lhx-agent-engine/plugin-memory

Long-term semantic memory: `SemanticMemory` implements core's `LongTermMemory` protocol (embedding → vector store → persistent backend). Core keeps only the `LongTermMemory` interface + a no-op default; this plugin provides the semantic implementation.

## Install

```bash
pnpm add @lhx-agent-engine/plugin-memory
```

## Usage

```ts
import { createSemanticMemory } from '@lhx-agent-engine/plugin-memory';

const longTermMemory = createSemanticMemory(vectorStore, embeddingProvider, memoryBackend);

// 装配时传入 assembleAgentLoop({ longTermMemory })
```

## API

- `SemanticMemory` — implements `LongTermMemory` (`remember` / `recall`); no-op when no `EmbeddingProvider`.
- `createSemanticMemory(vectorStore, embedding, backend)` — factory returning `LongTermMemory`.
