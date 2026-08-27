# Agent Engine

通用、可配置化的 **Agent 内核执行引擎（harness）**。

一句话：**配置即 Agent（Configuration as Agent）** —— 把 `plugins` / `mcp` / `skills` / `tools` / `system-prompt` / `memory` / `rules` / `hooks` 全部做成可配置项，后续搭建垂直领域 Agent 时**只需编写约束与规则的配置，无需改内核代码**。

## 核心特性

- **八大项全可配置**：能力（`tools` / `skills` / `mcp`）、扩展（`plugins`）、控制（`hooks` / `rules` / `guardrails`）、上下文（`system-prompt` / `memory`），全部由声明式配置装配。
- **三种配置格式**：YAML / JSON5 / TypeScript 归一化为同一份 `AgentConfig`（Zod 校验、深度冻结）。
- **可插拔 Provider / 后端**：LLM（默认 DeepSeek，OpenAI 兼容；Anthropic / ollama 可插拔）、记忆 / 缓存 / 向量库 / embedding / 检索 / 会话存储 / 日志——每个后端都是「接口 + in-memory 默认 + 注入点」。
- **单 Agent ReAct 循环**：hooks 生命周期、guardrail 拦截、Human-in-the-loop 审批、流式输出、取消与执行预算。
- **三层记忆**：token 预算窗口裁剪 → 滚动摘要 → 语义召回（embedding + 向量库）。
- **文档摄入**：异构文档（text/md/html/pdf/docx/epub）归一化为 Markdown → 分块 → BM25 词法检索注入上下文；配置 `embedding` 时升级为 BM25 + 向量语义召回（RRF 融合）（`documents` 配置轴）。
- **执行沙箱**：原生命令经 docker/nsjail；不可信 WASI 代码经 `FunctionSandbox`（`node:wasi`，零 Docker）。
- **规格驱动开发**：遵循 OpenSpec（propose → apply → archive）。

## 架构概览

```text
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
pnpm test               # Rstest 测试
pnpm lint               # Rslint 代码检查
pnpm typecheck          # tsc --noEmit 类型检查
pnpm spell              # cspell 拼写检查
pnpm lint:md            # markdownlint
```

## 包列表

| 包                           | 说明                                                      | 状态        |
| ---------------------------- | --------------------------------------------------------- | ----------- |
| `@agent-engine/config`       | 配置 Schema + 三格式加载                                  | ✅ 已实现   |
| `@agent-engine/core`         | 内核执行引擎（LLM / tools / agent loop / hooks / rules）  | ✅ 已实现   |
| `@agent-engine/server`       | HTTP 服务（REST + 流式）                                  | ✅ 已实现   |
| `@agent-engine/plugin-files` | 本地文件工具（`read_file` / `write_file` / `list_files`） | ✅ 已实现   |
| `@agent-engine/plugin-bash`  | 沙箱命令执行（`bash`）                                    | ✅ 已实现   |
| `@agent-engine/plugin-git`   | Git 工具套件（只读默认、经沙箱）                          | ✅ 已实现   |
| `@agent-engine/plugin-otel`  | OpenTelemetry 可观测插件                                  | 📦 骨架     |
| `@agent-engine/cli`          | 命令行入口                                                | 📦 骨架     |
| `@agent-engine/web`          | 一体化平台（`apps/web`）                                  | 🚧 部分实现 |
| `@agent-engine/docs`         | 文档站点（Rspress）                                       | 📦 骨架     |

## 里程碑

1. **M1 内核骨架** ✅：monorepo + config（Schema/loader）+ core（LLM Provider / Tool 注册表 / Agent Loop）。
2. **M2 配置化能力** ✅：hooks / rules / skills / plugins + system-prompt 组装 + 会话 memory + 内置工具 + 执行沙箱。
3. **M3 扩展接入** 🚧：MCP client ✅、resolve 层 ✅、流式输出 ✅、会话生命周期 ✅、循环强化 ✅、真思考透传 ✅、三层记忆 ✅、FunctionSandbox ✅、guardrail 配置轴 ✅、SessionStore/日志可插拔 ✅。剩余：多 Agent 编排。
4. **M4 服务化** 🚧：server HTTP API ✅。剩余：CLI。
5. **M5 平台与文档** 🚧：`apps/web` ✅。剩余：docs、Docker 编排、示例 Agent。

## 文档

- [`AGENTS.md`](./AGENTS.md) —— 权威项目文档（架构、规范、约定），开发前必读。
- [`docs/`](./docs) —— Rspress 文档站点。
- [`openspec/`](./openspec) —— 规格驱动开发（specs / changes）。

## License

待定。
