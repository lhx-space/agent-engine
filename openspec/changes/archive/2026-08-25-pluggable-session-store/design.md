## Context

server 层 `SessionStore` 是写死的 in-memory 类，无接口承接 redis 等分布式后端。批 C 要把它对齐「接口 + in-memory 默认 + 注入点」的尺子，与 core 的 `MemoryBackend` / `CacheBackend` 一致——core 定义抽象、后端由生态接入。

## Goals / Non-Goals

**Goals:**

- `SessionStoreBackend` 接口 + `InMemorySessionStore` 默认 + `options.sessionStore` 注入点。
- 接口方法异步化，使 redis 等后端可接（不限于同步内存语义）。

**Non-Goals:**

- 不做会话状态序列化 / `AgentLoop` 跨进程重建——`StoredSession` 仍持 in-process `AgentLoop`；真正的分布式会话（redis 存消息、进程重启重建 Agent）属后续里程碑。
- 不做分布式锁 / 一致性协议。
- 不改 `createApp` 的 HTTP 行为与端点契约。

## Decisions

### D1: 接口异步化（get/set/delete/clear 全 `Promise`）

**选择**：`SessionStoreBackend` 四个方法都返回 `Promise`，`InMemorySessionStore` 内部用 `Map`（同步实现、异步签名）。

**理由**：redis 等后端天然异步；同步签名会锁死为内存语义，违背「可插拔」。代价是 `app.ts` 的 `getOrCreateSession` 多两个 `await`，可忽略。

### D2: 生命周期（endSession + dispose）留在后端实现内，不进接口

**选择**：`delete` / `clear` 的实现方负责「移除 + 释放资源」；接口只约定语义（删除即结束会话并释放）。

**理由**：资源释放是「删除会话」语义的一部分，不该拆成两个调用点；各后端对「释放」的实现可能不同（内存直接 dispose，分布式需先取回状态）。

### D3: 重命名 `SessionStore` → `InMemorySessionStore`

**选择**：接口名 `SessionStoreBackend`，默认实现名 `InMemorySessionStore`；`index.ts` 不再导出旧名 `SessionStore`。

**理由**：与 `InMemoryMemoryBackend` / `InMemoryCacheBackend` 命名对齐；旧名 `SessionStore` 既是「存储」又是「实现」语义含糊。server 早期无外部消费方，破坏面可控。

## Risks / Trade-offs

- [异步接口改动小但破坏类名] → server 内部仅 app/types/index 三处引用，一次性同步；HTTP 行为不变。
- [分布式会话受限于 AgentLoop in-process] → 明确 Non-Goal；本 change 只打通「接口 + 注入点」，不假装解决序列化。
- [`size` 未进接口] → 仅 in-memory 内部淘汰用；后端需要自管容量，不进公共契约。

## Migration Plan

- 外部 `new SessionStore()` → `new InMemorySessionStore()`；`createApp({ sessionStore })` 传任意 `SessionStoreBackend`。
- 无配置字段变化。
