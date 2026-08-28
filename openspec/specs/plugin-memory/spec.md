# plugin-memory Specification

## Purpose

TBD - created by archiving change externalize-memory-plugin. Update Purpose after archive.

## Requirements

### Requirement: SemanticMemory 实现 LongTermMemory

系统 SHALL 提供 `@lhx-agent-engine/plugin-memory` 包，导出 `SemanticMemory`（实现 core 的 `LongTermMemory` 协议）与 `createSemanticMemory(vectorStore, embedding, backend)` 工厂。`remember` SHALL 经 `EmbeddingProvider` 向量化后写入 `VectorStore`（携带原文 metadata）并持久化到 `MemoryBackend`；`recall` SHALL 向量化 query 后 `VectorStore.query` 召回 top-k、返回原文。未注入 `EmbeddingProvider` 时 SHALL 静默 no-op。

#### Scenario: 召回相关记忆

- **WHEN** `remember('用户偏好蓝色')` 后 `recall('喜欢什么颜色', 3)`
- **THEN** 返回包含「用户偏好蓝色」的召回文本，且持久化到 `MemoryBackend`

#### Scenario: 无 embedding no-op

- **WHEN** `SemanticMemory` 未注入 `EmbeddingProvider` 时 `remember` / `recall`
- **THEN** 不抛错，`recall` 返回空数组，`remember` 不写入
