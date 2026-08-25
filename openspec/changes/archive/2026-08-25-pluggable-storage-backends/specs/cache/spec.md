# cache Specification

## Purpose

缓存后端抽象（`CacheBackend`）：内核定义接口 + in-memory 默认实现 + 注入/配置选择；生产后端（redis 等）由用户/生态接入。

## ADDED Requirements

### Requirement: 缓存后端 CacheBackend

系统 SHALL 定义 `CacheBackend` 接口（TTL KV 缓存）：`name`、`get(key)`、`set(key, value, ttlMs?)`、`delete(key)`、`clear()`；并提供 `InMemoryCacheBackend`（`name` 为 `in-memory`，存 `{ value, expiresAt }`，`get` 命中过期项自动清理并返回 `undefined`）作为开发默认。后端经 `PluginContext.registerCacheBackend` 注入，按 `cache.backend`（默认 `in-memory`）名字解析——内置 `in-memory` 与插件注册的后端按名查找，未注册名字抛可读错误；解析出的后端随 `ResolvedAgent.cacheBackend` 暴露。

#### Scenario: in-memory 读写与 TTL 过期

- **WHEN** 以 `InMemoryCacheBackend` `set` 无 TTL 的键后 `get`
- **THEN** 返回写入值；`set` 带 `ttlMs` 的键在过期后 `get` 返回 `undefined`

#### Scenario: 删除与清空

- **WHEN** `delete` 某键或 `clear`
- **THEN** 对应键不再命中，`clear` 后全部清空

#### Scenario: 配置按名解析

- **WHEN** `cache.backend` 未声明（默认 `in-memory`）
- **THEN** 解析出的 `ResolvedAgent.cacheBackend.name` 为 `in-memory`

#### Scenario: 插件注册自定义后端

- **WHEN** 一个 plugin 经 `registerCacheBackend` 注册名为 `redis` 的后端，且配置 `cache.backend: redis`
- **THEN** 解析出的后端为插件注册的实例

#### Scenario: 未注册名报错

- **WHEN** `cache.backend` 指向未注册名字
- **THEN** 装配期抛可读错误，不静默回退
