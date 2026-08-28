## Why

长期语义记忆的**实现** `SemanticMemory`（embedding 向量化 + 向量召回 + 持久化）仍以 core 一等公民存在（`memory/long-term-memory.ts`），`assemble` 硬编码 `new SemanticMemory(...)`。这违背「能力外放、core 只留协议 + 引擎」。

本 change 把 `SemanticMemory` 外放为 `@lhx-agent-engine/plugin-memory`，core 只保留 `LongTermMemory` 接口（协议）+ `noopLongTermMemory` 默认；`assemble` 改为「注入 or no-op」。

## What Changes

- **新增 `@lhx-agent-engine/plugin-memory`**：迁入 `SemanticMemory`（实现 `LongTermMemory`）；新增 `createSemanticMemory(vectorStore, embedding, backend)` 工厂。
- **core 留协议**：`LongTermMemory` 接口 + `noopLongTermMemory` 常量保留；`assemble` 不再 `new SemanticMemory`，改为 `options.longTermMemory ?? noopLongTermMemory`。
- **config 零迁移（D1-A）**：`memory.longTerm` 字段不变；语义实现由组合层（Phase 4）用 `plugin-memory` 装配。

## Capabilities

### New Capabilities

- `plugin-memory`: `@lhx-agent-engine/plugin-memory` 提供 `SemanticMemory`（实现 `LongTermMemory`）与 `createSemanticMemory` 工厂。

### Modified Capabilities

- `session-memory`: `SemanticMemory` 实现迁至 `plugin-memory`；core 只保留 `LongTermMemory` 协议与 `noopLongTermMemory` 默认。

## Impact

- 新增 `packages/plugins/plugin-memory/`（package.json / tsconfig / tsdown / src / tests / README）。
- 修改 `packages/core/src/memory/long-term-memory.ts`（删 SemanticMemory + 加 noop）、`memory/index.ts`、`agent/assemble.ts`、`index.ts`。
- 迁移 `packages/core/tests/long-term-memory.test.ts`（SemanticMemory 用例迁 plugin-memory；AgentLoop 协议用例保留）。
- 兼容性：`config.memory.longTerm` 字段不变。
