## Why

打开一个 agent 想要看到「上次聊到哪」是最基本的产品预期，但这条能力目前**三层同时断裂**：

1. **没有消息级持久化**——对话只存在于进程内的 `ConversationMemory` 数组，进程重启即消失；`AgentLoop.memory` 是 private，外层连读都读不到。
2. **现有 SessionStore 不是消息存储**——`apps/server` 的 `SessionStoreBackend` 只有 `get/set/delete/clear`，存的是**活的 AgentLoop 实例**（TTL 30 分钟 + LRU 淘汰），语义是「实例缓存」，与对话历史无关。两个东西都叫 session，已造成概念混淆。
3. **宿主没接**——`agents/` 的 chat 页面消息只在 `useState`，无 sessionId 概念、无历史读取 API；run 路由每次请求重建 Agent 并在 `finally` dispose，严格无状态。

同时，引擎的可插拔后端清单里（LLM / 搜索 / 沙箱 / MCP / Skills / Memory / Cache / VectorStore / Embedding / …）**唯独缺「对话流水」这一项**——它硬编码在内存里，谁也换不掉，与「配置即 Agent」的纪律相悖。平台化后这条缺口会直接挡住「市场 → 安装 agent → 看历史」的主链路。

## What Changes

- **新增 `ConversationStore` 可插拔后端协议**：`createSession` / `appendMessage` / `listMessages` / `listSessions` / `deleteSession`，与 `MemoryBackend` / `CacheBackend` / `VectorStore` 同构。
- **core 提供 `InMemoryConversationStore` 默认实现**，并新增注入出口：`PluginContext.registerConversationStore()`、`CapabilityBundle.conversationStores`、`ResolvedAgent.conversationStore`。
- **config 新增 `session.store`**（`in-memory` | `pg` | `redis`）与 `session.ttl`，沿用 `memory.longTerm.backend` / `cache.backend` 的按名解析写法。
- **`AgentLoop` 承载 `sessionId`**：每轮结束写盘，**覆盖异常与中断路径**（现状 `loop.ts:288` 仅在正常结束时写入）；对外暴露历史读取能力。
- **`plugin-pgvector` 提供 `PgConversationStore`**：新增 `agent_sessions` / `agent_messages` 两张表，经变更 `refactor-engine-persistence-schema` 建立的迁移机制落地。
- **语义澄清**：`apps/server` 的 `SessionStore` 改名 `SessionCache`，避免与对话历史混淆。
- 自托管宿主 `agents/` 做最小接线（sessionId 传递 + 历史读取），用于验证闭环。

## Capabilities

### New Capabilities

- `conversation-store`: 对话历史的持久化与回放——可插拔后端协议、会话与消息模型、按 sessionId 读写、默认 in-memory 实现。

### Modified Capabilities

- `session-memory`: 会话上下文需支持从持久化存储恢复与回写，且异常/中断路径同样落盘。
- `plugins`: 新增 `registerConversationStore` 注册出口与对应的能力汇聚。
- `agent-resolve`: `ResolvedAgent` 需暴露 `conversationStore` 供宿主读取历史。

## Impact

- 代码：`packages/core/src/agent/loop.ts`（sessionId、写盘时机、异常路径、历史出口）、`packages/core/src/memory/*`、`packages/core/src/resolve/*`、`packages/core/src/plugins/*`、`packages/config/src/schema/*`、`packages/plugins/plugin-pgvector/src/*`、`apps/server/src/infra/session-store.ts`（改名）、`agents/src/app/**`（最小接线）。
- 依赖：无新增三方依赖。
- 依赖顺序：本变更依赖 `refactor-engine-persistence-schema` 提供的迁移机制来建 `agent_sessions` / `agent_messages` 表。
- 兼容：`session.store` 缺省为 `in-memory`，不改变任何现有行为。
