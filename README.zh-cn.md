# Agent Engine

通用、可配置化的 **Agent 内核执行引擎（harness）**。

一句话：**配置即 Agent（Configuration as Agent）** —— 把 `plugins` / `mcp` / `skills` / `tools` / `system-prompt` / `memory` / `rules` / `hooks` 全部做成可配置项，后续搭建垂直领域 Agent 时**只需编写约束与规则的配置，无需改内核代码**。

## 核心特性

- **八大项全可配置**：能力（tools / skills / mcp）、扩展（plugins）、控制（hooks / rules）、上下文（system-prompt / memory）分层解耦。
- **三种配置格式**：YAML / JSON5 / TypeScript 归一化为同一份 `AgentConfig`（Zod 校验）。
- **可插拔 LLM Provider**：默认 DeepSeek（OpenAI 兼容），Anthropic / ollama 可插拔；不引入 LangChain（内核自研 + SDK 复用）。
- **单 Agent ReAct 循环**：LLM 调用 → 工具派发 → 结果回填 → 循环，含 hooks 生命周期管线。
- **规格驱动开发**：遵循 OpenSpec（propose → apply → archive）。

## 架构概览

```
                ┌── cli
config ← core ←┼── server ──(HTTP API)──▶ apps/web（React 19 + Rsbuild）
                └── plugins

docs/（Rspress）为独立站点
```

依赖方向单向：`config ← core ← cli / server ←(HTTP API) apps/web`。

## 快速开始

```bash
pnpm install            # 安装依赖
pnpm build              # tsdown 构建所有 packages
pnpm test               # Vitest 测试
pnpm lint               # Rslint 代码检查
pnpm typecheck          # tsc --noEmit 类型检查
```

## 包列表

| 包                          | 说明                                             | 状态        |
| --------------------------- | ------------------------------------------------ | ----------- |
| `@agent-engine/config`      | 配置 Schema + 三格式加载                         | ✅ 已实现   |
| `@agent-engine/core`        | 内核执行引擎（LLM / tools / agent loop / hooks） | 🚧 部分实现 |
| `@agent-engine/cli`         | 命令行入口                                       | 📦 骨架     |
| `@agent-engine/server`      | HTTP 服务（Docker 部署）                         | 📦 骨架     |
| `@agent-engine/plugin-otel` | OpenTelemetry 可观测插件                         | 📦 骨架     |
| `@agent-engine/web`         | 一体化平台（apps/web）                           | 📦 骨架     |
| `@agent-engine/docs`        | 文档站点（Rspress）                              | 📦 骨架     |

## 里程碑

1. **M1 内核骨架** ✅：monorepo + config（Schema/loader）+ core（LLM Provider / Tool 注册表 / Agent Loop）。
2. **M2 配置化能力** 🚧：hooks 管线 ✅ → rules 引擎 → system-prompt 组装 → skills / plugins → 会话 memory → 内置工具。
3. **M3 扩展接入**：MCP client、长期记忆（pgvector）、多 Agent 编排。
4. **M4 服务化**：server + CLI。
5. **M5 平台与文档**：apps/web + docs + Docker + 示例。

## 文档

- [`AGENTS.md`](./AGENTS.md) —— 权威项目文档（架构、规范、约定），开发前必读。
- [`docs/`](./docs) —— Rspress 文档站点。
- [`openspec/`](./openspec) —— 规格驱动开发（specs / changes）。

## License

待定。
