## Why

批 C 第二项（AGENTS.md §2.2 P2）：当前 server 的 `SessionStore` 是写死的 in-memory 具体类，无接口、无注入点，redis 等分布式会话后端无法接入。本 change 把它落成「接口 + in-memory 默认 + 注入点」，与 `MemoryBackend` / `CacheBackend` 同一套「core 只做适配器」尺子。

## What Changes

- `server/src/session-store.ts`：抽出 `SessionStoreBackend` 接口（`get` / `set` / `delete` / `clear`，异步签名以承接 redis 等后端）；`InMemorySessionStore` 实现之（沿用现有 TTL / LRU 淘汰 + `endSession`/`dispose` 生命周期）。
- `ServerOptions.sessionStore` 类型改为 `SessionStoreBackend`，`createApp` 缺省 `new InMemorySessionStore()`。
- 重命名 `SessionStore` → `InMemorySessionStore`（原类名移除，同步更新 `app.ts` / `types.ts` / `index.ts`）。

## Capabilities

### New Capabilities

<!-- 无新增能力目录：SessionStore 属 server-api 既有能力，本 change 只把具体类升级为可插拔接口。 -->

### Modified Capabilities

- `server-api`: 「会话复用与淘汰」需求由「具体类 `SessionStore`」改为「`SessionStoreBackend` 接口 + `InMemorySessionStore` 默认 + `options.sessionStore` 注入点」。

## Impact

- 修改 `packages/server/src/{session-store.ts,app.ts,types.ts,index.ts}`。
- 测试：`session.test.ts`（复用/淘汰/DELETE）继续通过；新增注入自定义后端的行为断言。
- **破坏性（server 内部小）**：类名 `SessionStore` 移除、接口方法转异步；外部若直接 `new SessionStore()` 需改 `new InMemorySessionStore()`。`createApp` 的 HTTP 行为不变。
