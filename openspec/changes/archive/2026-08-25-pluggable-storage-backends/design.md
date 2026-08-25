## Context

AGENTS.md §2.1 确立了「core 的职责 = 定义接口 + 提供 in-memory 默认实现 + 装配/注入点；具体后端由用户/生态以 plugin/factory 接入」。据此，LLM/Search/Sandbox/MCP/Skills 已达标；而**长期记忆 `MemoryBackend`** 与**缓存 `CacheBackend`** 是「接口都没定义」的缺口——`memory.longTerm.backend` 是死字段，`CacheBackend` 代码里不存在。本 change 补上这两块**接口层**，作为 M3 三层记忆与缓存消费的底座。

## Goals / Non-Goals

**Goals:**

- `MemoryBackend` 接口 + `InMemoryMemoryBackend` 默认；经 `PluginContext.registerMemoryBackend` 注入、`memory.longTerm.backend`（默认 `in-memory`）按名解析。
- `CacheBackend` 接口 + `InMemoryCacheBackend` 默认（TTL）；经 `PluginContext.registerCacheBackend` 注入、`cache.backend`（默认 `in-memory`）按名解析。
- 解析出的后端随 `ResolvedAgent` 暴露，供后续层/hooks 消费；未注册名字抛可读错误。

**Non-Goals:**

- 不做三层记忆的消费逻辑（正确截取已做、压缩摘要、语义召回均 M3）；`MemoryBackend` 本次只做「持久化接口层」，语义检索依赖 `VectorStore`/`Embedding`（另立）。
- 不做 `VectorStore` / `EmbeddingProvider`（M3，本 change 只立 MemoryBackend / CacheBackend 两块）。
- 不做 LLM 响应/检索结果的真实缓存消费（M3）；`CacheBackend` 本次只立接口 + 默认 + 选择。
- 不做 pgvector / redis 后端实现（用户/生态接入）。

## Decisions

### D1: `MemoryBackend` 定义为「长期记忆 KV 持久化接口」，不含语义检索

**选择**：`MemoryBackend = { name, get, set, delete, keys(prefix?), clear }`，纯 KV；`InMemoryMemoryBackend` 用 `Map` 实现。语义召回（`search`）不在其职责内——那是 `VectorStore`+`Embedding` 的事（M3）。

**理由**：长期记忆分「持久化」与「语义召回」两个正交能力。把持久化先立成独立接口，语义层（M3）在其上叠加向量检索，职责不混。KV 接口通用、用户可自由接 pgvector/redis/filesystem。

### D2: `CacheBackend` 定义为「TTL KV 缓存接口」

**选择**：`CacheBackend = { name, get, set(key,value,ttlMs?), delete, clear }`；`InMemoryCacheBackend` 存 `{ value, expiresAt }`，`get` 命中过期项自动清理并返回 `undefined`。

**理由**：AGENTS.md §3 已声明 `get/set/delete/clear + TTL`。TTL 是缓存区别于普通 KV 的核心语义，纳入接口；in-memory 用惰性过期（get 时判断），简单可靠。

### D3: 后端经 `CapabilityBundle` 汇聚，`assembleAgentLoop` 统一解析

**选择**：`PluginContext.registerMemoryBackend/registerCacheBackend` 把后端收进 `CapabilityBundle`（`memoryBackends`/`cacheBackends`），`mergeBundles` 汇聚；`assembleAgentLoop` 建注册表 = 内置 `in-memory` + 插件注册（同名后者覆盖），按 `memory.longTerm.backend` / `cache.backend` 名字解析，未注册抛可读错误；结果随 `ResolvedAgent` 返回。

**理由**：后端与 tools/skills/hooks 同属「插件注入的能力」，走同一 bundle 汇聚管道，不新开旁路；解析放在装配层（此时插件已装完、注册表完整），`resolveAgentConfig` 只需透传 `config.memory` / `config.cache`。

### D4: `cache` 作为 `AgentConfig` 可选新字段

**选择**：新增 `CacheConfigSchema = { backend: z.string().default('in-memory') }`，`AgentConfig.cache` 可选；缺省时按 `in-memory` 解析。与 `memory.longTerm.backend` 对称。

**理由**：缓存也是「可配置项」之一，声明式选后端名与 memory 一致；可选字段不破坏现有配置。

## Risks / Trade-offs

- [接口先行、消费后置] → `MemoryBackend`/`CacheBackend` 本次「有接口 + 有默认 + 可解析」，但尚无上层消费（三层记忆/LLM 缓存 M3）。这是刻意的底座先行，避免「先造消费逻辑再抽接口」的返工；风险是短期看起来「定义了没大用」，故本 change 用「解析 + 暴露 + 插件可注入 + 单测」证明其真实可接线，并写清消费边界。
- [同名后端覆盖语义] → 插件注册与内置同名时后者覆盖；与 `ToolRegistry.register` 同语义，可预期。
- [未注册名报错] → 配置拼错后端名会在装配期抛错（而非静默回退），更早暴露配置错误。

## Migration Plan

- `memory.longTerm.backend` 缺省 `in-memory`，行为不变；写 `pgvector` 等未注册名现在会装配期报错（此前是死字段无反馈）。
- 新增 `cache.backend`（可选），不写则默认 `in-memory`。
- 自定义后端：实现 `MemoryBackend` / `CacheBackend`，经插件 `registerMemoryBackend` / `registerCacheBackend` 注册即可被配置选中。
