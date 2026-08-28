# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 与 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 模型路由（`model.routes`：按复杂度 / 能力标签切换模型）
- LLM 响应缓存（`createCachingProvider`，可插拔 in-memory / redis）
- LLM 重试与多模型 fallback（`createResilientProvider`）
- `plugin-pgvector`（pgvector 向量存储 + 长期记忆 KV 持久化）
- `plugin-redis`（Redis 缓存后端）
- 远程 MCP（`source: http`，streamable-http / sse）
- Next.js 宿主（`agents/`，目录即 Agent + 对话 UI）
- 企业级知识库示例（`knowledge-agent`）

## [0.1.0] - 2026-08

### Added

- 内核执行引擎：AgentLoop（ReAct + 并行 tool_calls + 重试退避 + 续写）
- 可插拔后端抽象：`MemoryBackend` / `CacheBackend` / `VectorStore`
- 生命周期 hooks（10 个锚点，观察/改写不阻断）与 guardrails（声明式阻断）
- 能力插件全家桶：rules / skills / documents / memory / web / mcp / guardrails / files / bash / git / otel
- 三层记忆：会话裁剪 + 滚动摘要 + 语义召回
- 检索：BM25 + 向量 RRF 混合
- 沙箱：docker / nsjail 双后端 + WASI FunctionSandbox
- server HTTP API（REST + NDJSON 流式）
- 前端平台（apps/web，React 19 + Rsbuild + antd 6）
