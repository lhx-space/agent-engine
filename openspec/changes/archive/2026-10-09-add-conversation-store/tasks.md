## 1. 协议与默认实现（core）

- [x] 1.1 定义 `ConversationStore` 接口与 `ConversationMessage` / `ConversationSession` 类型（`packages/core/src/conversation/`）
- [x] 1.2 实现 `InMemoryConversationStore`（默认，带 `seq` 自增与 `limit` / `beforeSeq` 支持）
- [x] 1.3 `PluginContext` 增加 `registerConversationStore()`；`CapabilityBundle` 增加 `conversationStores` 并在 `mergeBundles` 汇聚
- [x] 1.4 `ResolvedAgent` 暴露 `conversationStore`
- [x] 1.5 单元测试：追加/顺序/限量读取/结束不清历史（`tests/conversation-store.test.ts`）

## 2. 配置层

- [x] 2.1 `packages/config`：新增 `SessionStoreSchema`（`store` / `historyLimit` / `ttl`），`store` 缺省 `in-memory`，Zod 定义并导出类型
- [x] 2.2 顶层 `session` 配置段挂载，并更新既有 agent 配置样例

## 3. Agent 运行期落盘

- [x] 3.1 `AgentLoop` 支持外部传入或使用自动生成的 `sessionId`（uuid），并在运行结果中返回
- [x] 3.2 正常返回 / 抛异常 / Abort 中断三条出口统一走收口逻辑写盘
- [x] 3.3 写盘失败 best-effort：发持久化失败事件，标记 `persisted: false`，不影响结果返回
- [x] 3.4 `endSession()` 改为只清内存窗口，不删持久层消息，会话标为结束
- [x] 3.5 运行开始时按 `sessionId` 从 `ConversationStore` 恢复历史注入上下文（受窗口裁剪约束）
- [x] 3.6 单元测试：三路径落盘、中断保留部分内容、存储故障不阻断、历史恢复注入（`tests/conversation-persist.test.ts`）

## 4. pg 实现与迁移

- [x] 4.1 依赖 `refactor-engine-persistence-schema` 的迁移机制，写 v3 迁移建 `agent_sessions` / `agent_messages`（含 `UNIQUE(session_id, seq)` 与索引）
- [x] 4.2 实现 `PgConversationStore`（`name: 'pg'`）并注册到 `plugin-pgvector`
- [x] 4.3 `listMessages` 支持 `limit` / `beforeSeq`；`listSessions` 支持按 `agentName` 过滤与分页
- [x] 4.4 `deleteSession` 级联删除消息（外键 `ON DELETE CASCADE`）
- [x] 4.5 集成测试：写入 → 重启进程 → 读取一致（`tests/pg-conversation.test.ts`，`DATABASE_URL` 存在时执行）

## 5. 语义澄清（apps/server）

- [x] 5.1 `SessionStore` / `SessionStoreBackend` 改名 `SessionCache` / `SessionCacheBackend`
- [x] 5.2 保留 `SessionStore` deprecated 类型别名一个版本，标注迁移说明
- [x] 5.3 更新 server 内引用与文档；run handler 显式传 `sessionId`，使缓存键与落盘 id 一致

## 6. 自托管宿主最小接线（agents/）

- [x] 6.1 run / run-stream 路由支持 `x-session-id` 请求头，未带则生成并在响应头回传
- [x] 6.2 新增 `GET /api/agent/[name]/sessions` 与 `GET /api/agent/[name]/sessions/[id]/messages`
- [x] 6.3 chat 页面：sessionId 落 localStorage，挂载时拉取历史并渲染，提供「新会话」入口
- [x] 6.4 冒烟验证：刷新页面后历史仍在（devops-agent / knowledge-agent 已配 `session.store: pg`）

## 7. 文档

- [x] 7.1 更新 `AGENTS.md` §2.1 表格：新增「对话历史 `ConversationStore` + `InMemoryConversationStore`」达标项
- [x] 7.2 更新 `plugin-pgvector` README 的 Tables 段落（新增两张表 + v3 迁移 + `session.store` 用法）
