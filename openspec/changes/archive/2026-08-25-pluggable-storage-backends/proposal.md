## Why

AGENTS.md §2.1 刚把「core 只做适配器」立为尺子，并点出两块「接口都没定义、文档却声称存在」的缺口：**长期记忆后端 `MemoryBackend`**（`memory.longTerm.backend` 是死字段，全仓零消费点）与**缓存后端 `CacheBackend`**（代码里连这个词都没有）。本 change 把这两块「可插拔存储后端」的**接口层**立起来——接口 + in-memory 默认实现 + 注入点 + 配置选择，让 `longTerm.backend` 从死字段变成真配置，缓存同理；具体的生产后端（pgvector / redis）与三层记忆/LLM 缓存的**消费逻辑**仍属 M3，将建在这套接口之上。

## What Changes

- 新增 `MemoryBackend` 接口（长期记忆 KV 持久化：`get`/`set`/`delete`/`keys`/`clear`）+ `InMemoryMemoryBackend` 默认实现（`core/memory/`）。
- 新增 `CacheBackend` 接口（TTL 缓存：`get`/`set(key,value,ttlMs?)`/`delete`/`clear`）+ `InMemoryCacheBackend` 默认实现（新模块 `core/cache/`）。
- `PluginContext` 增 `registerMemoryBackend` / `registerCacheBackend`；`CapabilityBundle` 携 `memoryBackends` / `cacheBackends`，`mergeBundles` 汇聚。
- 配置接线：`memory.longTerm.backend`（默认 `in-memory`）与新增 `cache.backend`（默认 `in-memory`）按名解析——内置 `in-memory` + 插件注册的自定义后端；未注册名字抛可读错误。解析出的后端随 `ResolvedAgent` 暴露（`memoryBackend` / `cacheBackend`）。
- `@agent-engine/core` 新增 `./cache` 子路径（`./memory` 已有）。

## Capabilities

### Modified Capabilities

- `session-memory`: 新增「长期记忆后端 MemoryBackend」需求。
- `cache`: 新增能力，定义「缓存后端 CacheBackend」需求。
- `plugins`: `PluginContext` / `PluginManager` / `CapabilityBundle` 增后端注入。
- `agent-config-schema`: 新增 `cache` 配置；`memory.longTerm.backend` 由死字段落地为可解析配置。

## Impact

- 新增 `packages/core/src/memory/memory-backend.ts`、`packages/core/src/cache/{cache-backend.ts,index.ts}`。
- 修改 `packages/core/src/memory/index.ts`、`plugins/{types,manager}.ts`、`capability/{types,bundle}.ts`、`agent/assemble.ts`、`resolve/{resolve,types}.ts`、`index.ts`、`types.ts`、`tsdown.config.ts`、`package.json`。
- 修改 `packages/config/src/schema/index.ts`（`cache` 配置）。
- 测试：新增 backend 单测（in-memory 行为 + 插件注入 + 配置解析 + 未注册报错）。
- **非破坏**：`cache` 为可选新增字段；`memory.longTerm.backend` 缺省仍 `in-memory`，行为不变。
