## Why

rules / skills 的按需检索目前是纯 BM25 词法召回（`CapabilityRegistry` + `CapabilityLoader`），命中依赖 meta 的 `description`/`tags` 与 query 的词面重叠；语义相关但用词不同的规则/技能会漏召回。文档检索已落地「BM25 + 向量 RRF 融合」，把同一套语义召回能力推广到能力检索，补全「统一能力检索」的语义层。

## What Changes

- `core/src/retrieval/registry.ts`：`CapabilityRegistry` 支持可选 `embedding`/`vectorStore`，`retrieve` 升级为「BM25 + 向量 RRF 融合」（async，语义召回失败优雅回落 BM25）。
- `core/src/retrieval/loader.ts`：`CapabilityLoader` 支持 `{ embedding, vectorStore }` 选项，`loadForQuery` 转 async。
- `core/src/rules/load.ts`：`loadRulesText` 转 async。
- 接线：`AgentLoopOptions` 增 `embeddingProvider`，`assembleAgentLoop` 传入；`ContextComposer` await 能力检索。

## Capabilities

### New Capabilities

<!-- 无新能力目录，capability-retrieval 已存在。 -->

### Modified Capabilities

- `capability-retrieval`: 新增「能力检索语义化（BM25 + 向量 RRF 融合）」需求。

## Impact

- 修改 `core/src/retrieval/{registry,loader,retriever}.ts`、`core/src/rules/load.ts`、`core/src/agent/{types,loop,assemble}.ts`、`core/src/context/context-composer.ts`。
- 测试：`retrieve`/`loadForQuery`/`loadRulesText` 签名转 async 需同步更新；新增 RRF 语义召回单测。
- **非破坏（功能）**：无 `embedding` 时仍为 BM25，行为一致；**签名破坏**：`CapabilityRegistry.retrieve` / `CapabilityLoader.loadForQuery` / `loadRulesText` 转 async（v0.1 内部 API）。
