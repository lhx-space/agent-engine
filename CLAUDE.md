# CLAUDE.md — Agent Engine（Claude Code 协作入口）

> 本仓库的权威文档是 `AGENTS.md`。开始任何工作前，请先完整阅读它：
>
> @AGENTS.md

## 一句话理解这个项目

**Agent Engine 是一个通用、可配置化的 Agent 内核执行引擎（harness）。**
`plugins / mcp / skills / tools / system-prompt / memory / rules / hooks` 全部可配置化；搭建垂直领域 Agent 时**只需写约束与规则的配置，不改内核代码**。

技术栈：TypeScript（strict）+ pnpm monorepo；库构建用 **tsdown**；文档站用 **Rspress**（docs）；平台前端用 **React 19 + Rsbuild + 生态库**（apps/web）；运维用 Docker。**LLM 默认走 DeepSeek（OpenAI 兼容），ollama 仅后期可选。**

## 协作时的核心纪律（务必遵守）

1. **能配置解决的不改内核**：修改 `core` 之前，先判断需求能否用 `hooks / rules / plugins / skills` 实现。内核只承载「执行引擎」，领域能力一律外置为配置或扩展。
2. **复用优先，拒绝重复造轮子（核心规则）**：动手前先调研成熟三方库/生态库（React 生态、Node 生态、协议 SDK 等），能用现成的就用现成的；只有无合适方案时才自研，并在 PR/注释中说明理由。什么都自己手写是有大问题的。
3. **内核自研、框架不引入**：执行内核（Agent Loop / 编排 / 插件 / hooks / rules）自研；**不引入 LangChain / LangGraph 等重型编排框架**。能力层一律复用官方 SDK（`openai` / `@anthropic-ai/sdk` / `@modelcontextprotocol/sdk`）。库照用、框架不引入。
4. **单一事实来源**：所有配置 Schema 用 Zod 定义，类型通过 `z.infer` 衍生；apps/web 的表单与编辑器**复用同一份 Schema**，不重复手写。
5. **可插拔优先**：LLM Provider（默认 DeepSeek）、记忆后端、向量库、MCP server 一律面向抽象接口实现。本地已有基础设施镜像优先复用：`pgvector/pgvector:pg16`、`redis:7-alpine`、`minio`、`meilisearch`、`prometheus`+`grafana`、`nginx/caddy`。
6. **依赖方向单向**：`config ← core ← cli / server ←(HTTP API) apps/web`，禁止反向/循环依赖。
7. **类型严格**：开启 `strict`、禁止 `any`，对外 API 显式导出类型。
8. **遵循 OpenSpec（规格驱动开发）**：功能开发先写 proposal + spec delta，再写代码（`/opsx:propose` → `/opsx:apply` → `/opsx:archive`）；禁止跳过规格直接改代码。详见 `openspec/`。

## 本仓库当前状态

- 仓库尚为**空骨架**，`AGENTS.md` / `CLAUDE.md` 已就绪，代码尚未开始。
- 待办以 `AGENTS.md` 第 14 节「下一步里程碑」为准：M1 内核骨架 → M2 配置化能力 → M3 扩展接入 → M4 服务化 → M5 平台与文档。

## 常用命令（落地后生效）

```bash
pnpm install
pnpm build          # Turborepo 编排 + 缓存构建所有 packages
pnpm lint           # Rslint 代码检查
pnpm format         # Prettier 格式化
pnpm typecheck      # tsc --noEmit 全仓类型检查
pnpm spell          # cspell 拼写检查
pnpm test           # Rstest
pnpm web:dev        # apps/web 开发
pnpm docs:dev       # Rspress 文档站
```

## 沟通约定

- 涉及架构/选型的分歧，先对齐再动手，避免写偏。
- 交付物明确列出改动文件（用 inline code 路径），便于点击跳转。
