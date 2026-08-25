## Why

批 B（AGENTS.md §2.2 P1 两项）：① Token 预算/上下文裁剪——当前 `ConversationMemory` 按「条数」裁剪，无 token 概念、无可插拔裁剪策略（三层记忆①②地基缺失）；② 检索策略——当前 `CapabilityLoader` 写死 BM25，RRF 融合/向量召回/重排无接口承接。本 change 立起四个接口 + 默认 + 注入 + 暴露（沿用「接口层先行」，消费逻辑 M3）。

## What Changes

- `context/`：`TokenCounter` 接口 + `ApproximateTokenCounter`（字符/4 粗估）默认；`ContextCompactor` 接口 + `TokenBudgetCompactor`（按 token 预算从头部淘汰整轮，不拆 tool_call 配对）默认。
- `retrieval/`：`Retriever` 接口 + `Bm25Retriever`（复用 `CapabilityRegistry`）默认；`Reranker` 接口 + `IdentityReranker`（保持原序）默认。
- 注入：`PluginContext.registerTokenCounter / registerContextCompactor / registerRetriever / registerReranker`；`CapabilityBundle` 携四类。
- 装配：`assembleAgentLoop` 解析默认（插件注册优先），随 `ResolvedAgent` 暴露 `tokenCounter` / `contextCompactor` / `retriever` / `reranker`。

## Capabilities

### Modified Capabilities

- `context-assembly` / `capability-retrieval`：新增四接口需求。
- `plugins`：`PluginContext` / `CapabilityBundle` 增四类注入。

## Impact

- 新增 `packages/core/src/context/{token-counter.ts,compactor.ts}`、`packages/core/src/retrieval/{retriever.ts,reranker.ts}`。
- 修改 `context/index.ts`、`retrieval/index.ts`、`plugins/{types,manager}.ts`、`capability/{types,bundle}.ts`、`agent/assemble.ts`、`resolve/types.ts`、`index.ts`、`types.ts`。
- 测试：四接口默认行为 + 插件注入 + 解析默认。
- **非破坏**：均为新增接口/注入点，现有裁剪与检索行为不变。
