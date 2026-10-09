## Context

现状三条关键事实（决定设计走向）：

1. 消息写入只发生在正常结束路径，且写进进程内数组：

```288:298:/Users/luhanxin/Desktop/agent-engine/packages/core/src/agent/loop.ts
  // （仅正常结束时）this.memory?.append(messages.slice(sessionStart))
```

异常与 `AbortError` 路径不回写（`:262-265`），`endSession()` 还会主动 `memory.clear()`（`:304-310`）。

1. `apps/server` 的 `SessionStoreBackend` 只有四个方法，存的是活的 `AgentLoop`：

```21:26:/Users/luhanxin/Desktop/agent-engine/apps/server/src/infra/session-store.ts

```

1. 宿主无 sessionId、无历史 API，每次请求重建 + dispose：

```56:61:/Users/luhanxin/Desktop/agent-engine/agents/src/app/api/agent/[name]/run/stream/route.ts

```

约束：core 只出接口 + in-memory 默认实现 + 注入点；具体后端由插件提供；配置一律 Zod；不引入框架。

## Goals / Non-Goals

**Goals:**

- 让「对话流水」成为与其他后端同构的第 N 个可插拔后端，配置一行即可切换实现。
- 让历史对话可持久化、可按 sessionId 回放，并覆盖异常/中断路径。
- 让存储实现可替换（in-memory / pg / redis），core 不绑定任何数据库。
- 消除「session」一词的双重语义。

**Non-Goals:**

- 不做会话标题自动生成、不做历史摘要回灌策略（下一批）。
- 不做多租户/用户维度的会话隔离（第一版 `user_id` 占位 `'default'`）。
- 不改动 `ConversationMemory` 的上下文窗口与裁剪语义。
- 不在本次做平台侧 UI（`add-platform-marketplace` 负责），仅做自托管宿主的最小接线以验证闭环。

## Decisions

### 决策 1：新开 `ConversationStore` 协议，而非扩展 `MemoryBackend`

`MemoryBackend` 是 KV 语义（`get/set/keys/delete`），而对话需要 **append + 按会话范围有序读取**。把消息塞进 KV 会退化为「整块读 → 追加 → 整块写」，并发与体量都不可接受。因此新增独立协议，与 `MemoryBackend` / `CacheBackend` / `VectorStore` 平级，接入同样的四个扩展出口。

**备选**：扩展 `MemoryBackend` 加 `append` / `range`。否决理由：职责混淆，且 KV 后端（in-memory/pg/redis）的实现契约会被撕裂。

### 决策 2：消息模型带 `seq` 与 `role`，工具调用结构化

```sql
agent_messages(id bigint identity PK, session_id text, seq int, role text,
               content text, tool_calls jsonb, tool_call_id text, name text,
               tokens int, meta jsonb, created_at timestamptz, UNIQUE(session_id, seq))
```

`seq` 保证会话内顺序（不依赖时间戳精度），`UNIQUE(session_id, seq)` 天然防重复写；`tool_calls` 独立列而非塞进 content，使回放时可折叠工具调用。

**备选**：整轮存一个大 jsonb。否决理由：无法按条翻页、无法增量追加、无法统计。

### 决策 3：session_id 用 uuid v4，与平台侧软关联

`agent_sessions.id` 为 uuid 文本，安全可出现在 URL；平台侧 `runs.session_id` 只存这个字符串，**不建跨库外键**，为将来拆库留余地。

### 决策 4：写盘时机放在 loop 的收口处，覆盖全部出口

在正常返回、抛出异常、外部中断（Abort）三条出口都执行写盘；中断时写已产生的部分消息。写盘失败按 best-effort 记录，不阻断主流程返回（对话结果不应因存储故障丢失）。

### 决策 5：`endSession()` 不再清空历史

现状 `endSession()` 调 `memory.clear()`，语义是「结束本次内存会话」。持久化后改为只清内存窗口、不动持久层，会话状态标为结束但消息保留。

### 决策 6：`apps/server` 的 `SessionStore` 改名 `SessionCache`

它是「活 Agent 实例 + TTL/LRU」的缓存，改名后与 `ConversationStore`（对话流水）语义分离，避免后续误用。

### 决策 7：宿主接线最小化，`x-session-id` 复用现有约定

沿用 `apps/web` / `apps/server` 已有的 `x-session-id` 头：客户端首次请求不带，服务端生成并在响应头回传；后续请求带上即续接同一会话。新增两个只读端点用于渲染历史。

## Risks / Trade-offs

- **[写盘失败丢历史]** best-effort 写盘失败会静默丢消息 → 记录结构化告警事件（走 events 总线），并在响应中标记 `persisted: false`，便于排查。
- **[长会话回放成本]** 全量回放会撑爆上下文 → 第一版只提供「最近 N 条」读取能力，摘要回灌策略下一批做，接口预留 `limit` / `beforeSeq` 参数。
- **[工具消息体量大]** `tool_calls` 与工具结果可能很长 → 第一版不做裁剪，但 `meta` 预留 `truncated` 标记位；后续可加长度上限。
- **[并发写同一会话]** 同一 sessionId 并发运行会导致 `seq` 冲突 → 依赖 `UNIQUE(session_id, seq)` 让冲突显式暴露，第一版不引入分布式锁。
- **[双 session 概念迁移期并存]** 改名会有短暂共存 → 保留 `SessionStore` 类型别名一个版本，标注 deprecated。

## Migration Plan

1. 先落地协议与 in-memory 实现（无存储依赖，可独立发布）。
2. 再落 `PgConversationStore` 与 v3 迁移（建 `agent_sessions` / `agent_messages`），依赖前一个 change 的迁移机制。
3. `session.store` 缺省 `in-memory`，现有行为零变化；切换为 `pg` 是配置动作，可回滚。
4. `apps/server` 改名同步做，保留 deprecated 别名一个版本。

## Open Questions

- 历史回灌上下文的默认条数（N）取多少？需要实测 token 成本后定（暂定 20 条）。
- `redis` 实现是否同一版本提供？倾向先只做 pg + in-memory，redis 随平台按需补。
