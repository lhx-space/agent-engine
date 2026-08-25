## ADDED Requirements

### Requirement: 长期记忆后端 MemoryBackend

系统 SHALL 定义 `MemoryBackend` 接口（长期记忆 KV 持久化）：`name`、`get(key)`、`set(key, value)`、`delete(key)`、`keys(prefix?)`、`clear()`；并提供 `InMemoryMemoryBackend`（`Map` 实现，`name` 为 `in-memory`）作为开发默认。后端经 `PluginContext.registerMemoryBackend` 注入，按 `memory.longTerm.backend`（默认 `in-memory`）名字解析——内置 `in-memory` 与插件注册的后端按名查找，未注册名字抛可读错误；解析出的后端随 `ResolvedAgent.memoryBackend` 暴露。

#### Scenario: in-memory 默认读写

- **WHEN** 以 `InMemoryMemoryBackend` 执行 `set` 后 `get`
- **THEN** 返回写入值；`delete` 后 `get` 返回 `undefined`；`keys` 反映剩余 key

#### Scenario: 配置按名解析

- **WHEN** `memory.longTerm.backend` 未声明（默认 `in-memory`）
- **THEN** 解析出的 `ResolvedAgent.memoryBackend.name` 为 `in-memory`

#### Scenario: 插件注册自定义后端

- **WHEN** 一个 plugin 经 `registerMemoryBackend` 注册名为 `pgvector` 的后端，且配置 `memory.longTerm.backend: pgvector`
- **THEN** 解析出的后端为插件注册的实例

#### Scenario: 未注册名报错

- **WHEN** `memory.longTerm.backend` 指向未注册名字
- **THEN** 装配期抛可读错误，不静默回退
