# AGENTS.md — Agent Engine 项目说明

> 本文件是项目的权威文档，面向所有在此仓库协作的 AI Agent 与人类开发者。开始任何开发前，请先完整阅读本文。

---

## 1. 项目定位

**Agent Engine** 是一个通用的、可配置化的 **Agent 内核执行引擎（harness）**。

核心目标：**把 `plugins`、`mcp`、`skills`、`tools`、`system-prompt`、`memory`、`rules`、`hooks` 全部做成可配置项**。后续搭建垂直领域 Agent 时，只需要「编写约束与规则的配置」，无需改内核代码，即可由 harness 驱动生成一个垂直领域 Agent。

一句话：**配置即 Agent（Configuration as Agent）**。

### 核心诉求拆解

| 诉求             | 含义                                                     |
| ---------------- | -------------------------------------------------------- |
| 通用内核         | 一套与业务无关的执行引擎，负责 Agent 的完整运行生命周期  |
| 全部可配置化     | 能力、约束、记忆、提示词、规则、钩子均通过声明式配置装配 |
| 配置即领域 Agent | 垂直领域差异收敛到配置层，内核零改动                     |
| 运维友好         | Docker 一键部署，配置可热挂载/热更新                     |

---

## 2. 核心设计理念

1. **内核与能力解耦**：内核只关心「如何执行」，不关心「执行什么」。所有具体能力通过 `tools / skills / plugins / mcp` 注入。
2. **统一配置 Schema**：无论配置写成 YAML / JSON / TypeScript，加载后都归一化为同一份 `AgentConfig`（Zod 校验），内核只面向这一份 Schema 工作。
3. **可插拔 Provider**：LLM、记忆后端、向量库、MCP server 都是可插拔的实现，内核只依赖抽象接口。
4. **生命周期可拦截**：执行流程的关键节点暴露 hooks，插件与规则可以无侵入地增强或拦截行为。
5. **编排能力内置**：内核同时支持单 Agent 循环与多 Agent 编排（orchestrator + subagents），通过配置声明拓扑。
6. **复用优先，拒绝重复造轮子（核心纪律）**：动手前先调研并采用成熟三方库/生态库（React 生态、Node 生态、协议 SDK 等）；仅当无合适现成方案时才自研，且需在注释/PR 中说明理由。
7. **内核自研 + SDK 复用（不引入 LangChain）**：执行内核（Agent Loop / 编排 / 插件 / hooks / rules）自研，因为这是核心资产且需细粒度控制；能力层一律复用官方 SDK（LLM / MCP / 向量等）。库照用、框架不引入。

---

## 3. 技术栈选型

| 维度        | 选型                                          | 说明                                                                              |
| ----------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| 语言        | TypeScript 5.x（strict）                      | 全链路类型安全                                                                    |
| 运行时      | Node.js >= 20 LTS                             | ESM 优先（`"type": "module"`）                                                    |
| 包管理      | pnpm >= 9 + workspace                         | monorepo                                                                          |
| 构建        | tsdown                                        | VoidZero 出品、基于 rolldown，tsup 的现代替代，ESM/CJS + d.ts                     |
| 代码检查    | Rslint（Go 引擎，兼容 ESLint/TS-ESLint 规则） | 快，内置 TypeScript-ESLint 规则                                                   |
| 格式化      | Prettier                                      | 统一代码风格                                                                      |
| 拼写检查    | cspell                                        | 术语一致性                                                                        |
| 类型检查    | tsc --noEmit                                  | 全仓类型检查                                                                      |
| Git hooks   | husky + lint-staged + commitlint              | 提交前自动检查 + 提交信息校验                                                     |
| 测试        | Vitest                                        | 单测 + 集成测试                                                                   |
| Schema 校验 | Zod                                           | 配置统一校验，衍生 TS 类型                                                        |
| 配置加载    | `yaml` + `json5` + `jiti`                     | YAML/JSON(带注释)/TS 三种格式                                                     |
| LLM SDK     | `openai` + `@anthropic-ai/sdk`                | 统一 `Provider` 接口，**默认 DeepSeek**（OpenAI 兼容），Anthropic/ollama 等可插拔 |
| MCP         | `@modelcontextprotocol/sdk`                   | client 模式接入外部 server                                                        |
| 日志        | pino                                          | 结构化日志，可接 OpenTelemetry                                                    |
| CLI         | commander                                     | harness 命令行入口                                                                |
| 服务        | 内置轻量 HTTP Server                          | 供 Docker 化后对外提供 API                                                        |
| Web 前端    | React 19 + Rsbuild + 生态库                   | apps/web 一体化平台（React Router/Query/Zustand 等）                              |
| 文档站点    | Rspress                                       | docs 目录，Rspack 生态文档站                                                      |
| 容器        | 多阶段 Dockerfile                             | 配置以卷挂载，支持热更新                                                          |

> 说明：长期记忆/向量库不锁定具体产品，内核只定义 `MemoryBackend` / `VectorStore` 抽象接口。开发默认 `in-memory`，生产默认 `pgvector`（本地已有 `pgvector/pgvector:pg16` 镜像），`chroma` / `lanceDB` / `meilisearch` 等以插件形式接入。

### 3.1 框架选型：自研内核 + SDK 复用（不引入 LangChain）

**结论**：执行内核自研，能力层全部复用官方 SDK；不引入 LangChain / LangGraph 等重型编排框架。

理由：

1. **内核即核心资产**：本项目价值在于「可配置化的执行引擎」，hooks（可拦截/阻断）、rules（guardrail）是第一等公民。LangChain 的抽象（Runnable/Chain/AgentExecutor）反而束缚对执行链路的精细控制，套框架需额外写 adapter。
2. **稳定性风险**：LangChain.js 版本迭代频繁（v0.1 → v0.3 多次破坏性变更），不宜作为长期内核依赖。
3. **自研的是「胶水层」，非重复造轮子**：循环 + 编排 + 装配本质是少量胶水代码，无现成库能直接满足「八大项全可配置」；有成熟库的部分一律复用，不违背「复用优先」。

边界清单：

| 复用（用库，不自己写）                    | 自研（核心资产）                  |
| ----------------------------------------- | --------------------------------- |
| `openai` / `@anthropic-ai/sdk`（LLM）     | Agent Loop（ReAct）               |
| `@modelcontextprotocol/sdk`（MCP）        | 多 Agent 编排器                   |
| `zod` / `yaml` / `json5` / `jiti`（配置） | Plugin 系统、Hook 管线、Rule 引擎 |
| `pgvector` / `ioredis` / `minio`（后端）  | system-prompt 组装、memory 薄层   |
| `pino` / OTel（可观测）                   | 配置归一化 resolve                |
| React 生态 / Monaco / React Flow（Web）   | ——                                |

> 一句话：**库（SDK）照用，框架（LangChain）不引入。**

---

## 4. 目录结构（monorepo）

```
agent-engine/
├── CLAUDE.md                  # Claude Code 入口说明（@本文件）
├── AGENTS.md                  # 本文件，权威文档
├── package.json               # 根 scripts + 共享 devDependencies
├── pnpm-workspace.yaml        # workspace：packages/* / apps/* / docs
├── tsconfig.base.json         # 共享 TS 配置（strict）
├── rslint.config.ts           # 代码检查（Rslint，ESLint flat config 兼容）
├── .prettierrc                # 格式化（Prettier）
├── cspell.json                # 拼写检查
├── commitlint.config.mjs      # 提交信息校验（Conventional Commits）
├── lint-staged.config.mjs     # 暂存文件提交前检查
├── vitest.config.ts           # 测试配置
├── .npmrc / .nvmrc / .editorconfig / .gitignore / .gitattributes
├── .husky/                    # git hooks（pre-commit / commit-msg）
├── .vscode/                   # IDE 推荐配置与扩展
├── openspec/                  # OpenSpec 规范（specs/ · changes/ · config.yaml）
├── docs/                      # 文档站点（Rspress）—— 架构设计、API、使用指南
├── apps/
│   └── web/                   # @agent-engine/web —— WebApp（React 19 + Rsbuild）
├── packages/
│   ├── core/                  # @agent-engine/core   —— 内核执行引擎（最核心）
│   │   └── src/
│   │       ├── agent/         #   Agent Loop、单/多 Agent 编排器
│   │       ├── llm/           #   Provider 抽象（OpenAI/Anthropic/自定义）
│   │       ├── tools/         #   Tool 注册表与执行器
│   │       ├── mcp/           #   MCP client 接入，tools 归一化
│   │       ├── memory/        #   会话上下文 + 长期记忆抽象
│   │       ├── skills/        #   Skill 加载/注册/触发
│   │       ├── plugins/       #   插件系统与 PluginContext
│   │       ├── hooks/         #   生命周期钩子管线
│   │       ├── rules/         #   规则引擎（静态约束 + 动态 guardrail）
│   │       ├── context/       #   system-prompt 组装、上下文窗口管理
│   │       ├── events/        #   事件总线、可观测
│   │       └── types.ts       #   对外核心类型
│   ├── config/                # @agent-engine/config —— 配置加载 + Schema
│   │   └── src/
│   │       ├── schema/        #   Zod Schema（AgentConfig 等）
│   │       ├── loader/        #   yaml/json5/jiti 加载器
│   │       └── resolve/       #   配置归一化、引用解析、校验
│   ├── cli/                   # @agent-engine/cli   —— 命令行入口
│   ├── server/                # @agent-engine/server —— HTTP 服务（Docker 部署）
│   └── plugins/               # 内置插件（如 logger、otel 等）
├── examples/                  # 垂直领域 Agent 配置示例
│   ├── devops-agent/
│   └── code-review-agent/
├── agents/                    # 运行时挂载的 agent 配置目录（Docker 卷挂载点）
└── docker/
    ├── Dockerfile
    └── docker-compose.yml
```

### 依赖方向（保持单向，避免循环依赖）

```
                ┌── cli
config ← core ←┼── server ──(HTTP API)──▶ apps/web（React 19 + Rsbuild）
                └── plugins

docs/（Rspress）为独立站点，无运行时依赖
```

- `config`：只依赖 `zod` / `yaml` / `json5` / `jiti`，无业务逻辑。
- `core`：依赖 `config` 的类型，实现引擎。
- `cli` / `server`：依赖 `core` 与 `config`。
- `apps/web`：通过 HTTP API 调用 `server`，并复用 `config` 的 Zod Schema（表单校验、编辑器补全）。

---

## 5. 核心概念与分层关系

这是理解本项目最重要的心智模型。八个可配置项分属四个层次：

### 5.1 能力层（Agent 能「做什么」）

- **tools**：原子能力单元，一个函数即一个工具（如 `read_file`、`bash`、`web_search`）。注册进 **Tool Registry**。
- **skills**：可复用能力包 = 一份指令（`SKILL.md`）+ 可选捆绑的 tools/资源。按需动态加载，加载后将其指令注入上下文、工具并入注册表。
- **mcp**：通过 Model Context Protocol 接入的**外部能力来源**。一个外部 MCP server 的 `tools/resources` 会被归一化为标准 Tool，纳入同一注册表，内核无感知差异。

### 5.2 扩展层（能力的「打包与分发」单元）

- **plugins**：最大的扩展单元，可打包「多个 tools + skills + hooks + rules + memory 后端 + system-prompt 片段」整体注册/卸载。插件通过 `PluginContext` 注入能力，是实现「开箱即用领域能力」的载体。

### 5.3 执行控制层（Agent「如何做」的约束）

- **hooks**：生命周期事件拦截点，用于无侵入地增强执行流程（日志、审计、限流、埋点、内容过滤）。
- **rules**：规则/约束，分两类：
  - **静态规则**：作为约束文本注入 system-prompt。
  - **动态规则（guardrail）**：在关键节点（如 `beforeToolCall` / `afterToolCall`）做拦截与校验，可阻断危险行为。

### 5.4 上下文层（Agent「知道什么」）

- **system-prompt**：系统提示词，由「模板 + 变量 + 各模块（skills/rules/plugins）注入的片段」组装而成。
- **memory**：记忆管理，分两层：
  - **会话上下文**：单次会话的 message 窗口管理（含窗口裁剪/压缩）。
  - **长期记忆**：跨会话的持久化 + 向量检索（可选，后端可插拔）。

### 关系速记

```
plugin（分发单元，最大）
  ├── 可打包 → skill（能力包）→ tool（原子能力）
  ├── 可打包 → hooks / rules / memory 后端 / prompt 片段
  └── 可声明依赖

mcp → 外部 server → 归一化为 tool（与内置 tool 平级）

system-prompt ← 模板 + variables + skills/rules/plugins 注入片段
memory       ← 会话上下文 + 长期记忆（后端可插拔）
```

---

## 6. 内核执行引擎

### 6.1 单 Agent 执行循环（ReAct）

```
启动
 └─ 加载配置 → 归一化 AgentConfig → 校验
      └─ 装配：注册 plugins / tools / skills / mcp
            └─ 组装 system-prompt 与 rules
                  └─ 进入 Agent Loop：

 while (未终止 && 未超限):
   ├─ hooks.beforeLLM
   ├─ LLM 调用（messages + 可用 tools）
   ├─ hooks.afterLLM
   ├─ 若返回 tool_calls：
   │    ├─ rules 动态校验（guardrail）
   │    ├─ hooks.beforeToolCall
   │    ├─ 执行 tools（含 MCP 归一化工具）
   │    ├─ hooks.afterToolCall
   │    └─ 结果回填 messages，进入下一轮
   └─ 否则：
        └─ 产出最终结果，退出循环

 └─ hooks.onSessionEnd
```

### 6.2 多 Agent 编排

- **orchestrator + subagents**：主 Agent 可 `spawn` 子 Agent，支持顺序/并行执行，结果汇总回主 Agent。
- 编排拓扑通过配置声明（如 `orchestration: { mode: "sequential" | "parallel" | "graph" }`）。
- 每个 subagent 可拥有独立的 system-prompt / tools / memory 作用域。

### 6.3 生命周期钩子（hooks）清单

| 钩子             | 触发时机                                 |
| ---------------- | ---------------------------------------- |
| `onInit`         | 配置加载、装配开始                       |
| `onSessionStart` | 会话开始                                 |
| `beforeLLM`      | 调用模型前（可改写 prompt / 注入上下文） |
| `afterLLM`       | 模型返回后（可改写结果 / 记录）          |
| `beforeToolCall` | 工具执行前（可拦截 / 改写参数）          |
| `afterToolCall`  | 工具执行后（可改写结果 / 审计）          |
| `onStepEnd`      | 单轮循环结束                             |
| `onSessionEnd`   | 会话结束                                 |
| `onError`        | 任何错误                                 |

---

## 7. 配置系统

### 7.1 三种格式统一归一化

- **YAML**：默认推荐，运维友好、可读、支持注释与热加载。
- **JSON / JSON5**：程序化生成友好，支持注释。
- **TypeScript**：类型安全、可编程（通过 `jiti` 动态加载，`export default` 配置对象）。

三者加载后统一走 **Zod Schema 校验**，产出同一份 `AgentConfig`。内核只面向 `AgentConfig`。

### 7.2 配置示例（垂直领域 Agent：devops-agent.yaml）

```yaml
name: devops-agent
description: 云原生与 CI/CD 领域的 DevOps 助手
version: 1.0.0

model:
  provider: openai-compatible # 或 anthropic / custom
  baseURL: https://api.deepseek.com/v1
  model: deepseek-chat
  temperature: 0.2
  maxTokens: 4096

systemPrompt:
  template: |
    你是 {{role}}，专注于 {{domain}} 领域。
    必须遵守以下规则：
    {{rules}}
  variables:
    role: DevOps 运维专家
    domain: 云原生与 CI/CD

rules:
  - id: no-destructive-command
    description: 禁止执行破坏性命令
    kind: guardrail
    on: beforeToolCall
  - id: always-explain
    description: 执行前先说明意图
    kind: static

tools:
  - use: builtin.read_file
  - use: builtin.write_file
  - use: builtin.bash

mcp:
  servers:
    - name: github
      command: npx
      args: ['-y', '@modelcontextprotocol/server-github']
      env:
        GITHUB_TOKEN: ${GITHUB_TOKEN}

skills:
  - path: ./skills/incident-response
  - path: ./skills/k8s-diagnosis

memory:
  session:
    maxMessages: 50
  longTerm:
    backend: pgvector # 生产默认；开发用 in-memory

hooks:
  - plugin: builtin.logger
    on: [beforeLLM, afterToolCall, onError]

plugins:
  - '@agent-engine/plugin-otel'

orchestration:
  mode: single # single | sequential | parallel | graph
```

---

## 8. 扩展机制

### 8.1 新增一个 tool

1. 在对应包中实现 `Tool` 接口（`name` / `description` / `inputSchema` / `execute`）。
2. 通过 `ToolRegistry.register()` 或配置文件 `tools` 段注册。
3. 覆盖 `inputSchema`（Zod），保证 LLM 可正确理解参数。

### 8.2 新增一个 skill

```
skills/<skill-name>/
└── SKILL.md      # frontmatter: name, description；正文为指令
    └── (可选) 脚本 / 资源文件
```

- 在配置 `skills` 段声明路径即可。
- 内核按需加载：当任务相关时，将 `SKILL.md` 指令注入上下文、捆绑工具并入注册表。

### 8.3 新增一个 plugin

实现插件接口并通过 `PluginContext` 注册能力：

```ts
interface Plugin {
  name: string;
  version: string;
  install(ctx: PluginContext): void | Promise<void>;
}

interface PluginContext {
  registerTool(tool: Tool): void;
  registerSkill(skill: Skill): void;
  registerHook(hook: Hook): void;
  registerRule(rule: Rule): void;
  registerMemoryBackend(backend: MemoryBackend): void;
  provideSystemPrompt(fragment: string): void;
}
```

### 8.4 新增一个垂直领域 Agent

**零内核代码改动**，仅新增一份配置文件（如 `agents/<domain>.yaml`），声明模型、prompt、rules、tools、mcp、skills、memory、hooks、plugins 即可。放入 `agents/` 目录后由 harness 自动发现或 CLI 指定加载。

---

## 9. WebApp（apps/web）

**定位**：配置管理 + 运行一体化的平台（可视化编辑 Agent 配置 + 运行对话 + 查看日志/观测）。

**技术栈**（React 最新版 + 生态库，优先三方库）：

| 能力       | 选型                                                      |
| ---------- | --------------------------------------------------------- |
| 框架       | React 19                                                  |
| 构建       | Rsbuild（Rspack 生态，与 Rspress/tsdown 统一）            |
| 路由       | React Router                                              |
| 服务端状态 | TanStack Query                                            |
| 表单       | React Hook Form + Zod（**直接复用 config 包的 Schema**）  |
| 客户端状态 | Zustand                                                   |
| UI 组件    | shadcn/ui（Radix + Tailwind）                             |
| 样式       | Tailwind CSS                                              |
| 配置编辑   | Monaco Editor（JSON/YAML 编辑，复用 Schema 做校验与补全） |
| 编排可视化 | React Flow（多 Agent 拓扑）                               |
| 数据展示   | TanStack Table                                            |

> 关键点：前端表单校验、编辑器补全、类型提示**全部复用 config 包的同一份 Zod Schema**，让「单一事实来源」延伸到 UI 层。

---

## 10. 开发约定

### 10.1 TypeScript 约定

- 开启 `strict`，禁止 `any`（确需时用 `unknown` + 类型守卫）。
- 对外 API 显式导出类型，包边界通过 `exports` 字段控制。
- 配置 Schema 一律用 Zod 定义，并 `z.infer` 衍生类型（单一事实来源）。
- ESM 优先，导入路径使用 `import type` 区分类型导入。

### 10.2 命名约定

- 包名：`@agent-engine/<name>`，目录名与包名一致。
- 文件：小写 kebab-case（`agent-loop.ts`）。
- 类型/接口：PascalCase（`AgentConfig`、`Tool`）。
- 常量/枚举：UPPER_SNAKE_CASE 或 `as const` 对象。

### 10.3 提交信息

遵循 Conventional Commits，由 **commitlint** 在 `commit-msg` hook 强制校验：
`feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:`。

### 10.4 变更原则

- 修改 `core` 前先看是否能用 hooks/plugins/rules 实现——**能配置解决的，不改内核**。
- 新增能力优先考虑做成 tool / skill / plugin，而非硬编码进执行循环。
- 所有新模块必须有 Zod Schema + 单测。

### 10.5 开发流程（OpenSpec）

本项目遵循 **OpenSpec**（spec-driven development，规格驱动开发）：

- **目录**：`openspec/specs/`（当前行为真相源）、`openspec/changes/`（变更提案）、`openspec/config.yaml`（项目上下文）。
- **工作流**：`/opsx:propose <change>`（先写提案与 spec delta）→ `/opsx:apply`（实现）→ `/opsx:archive`（归档，把 spec delta 合并进 specs/）。
- **Delta spec**：用 `## ADDED / MODIFIED / REMOVED Requirements` 描述变更，`archive` 后自动合并进主 spec。
- **原则**：功能开发**先写 proposal/spec，再写代码**；禁止跳过规格直接改代码。
- OpenSpec 的 slash commands（`/opsx:*`）与 skills 已内置于 `.codebuddy/`。

---

## 11. 常用命令

```bash
pnpm install            # 安装依赖
pnpm build              # tsdown 构建所有 packages
pnpm dev                # watch 模式开发（packages）
pnpm lint               # Rslint 代码检查
pnpm lint:fix           # Rslint 自动修复
pnpm format             # Prettier 格式化
pnpm format:check       # Prettier 格式校验
pnpm typecheck          # 全仓类型检查（tsc --noEmit）
pnpm spell              # cspell 拼写检查
pnpm test               # 运行测试（Vitest）
pnpm test --watch       # 监听模式
pnpm web:dev            # apps/web 开发（React 19 + Rsbuild）
pnpm docs:dev           # Rspress 文档站开发

# 通过 CLI 运行一个垂直领域 Agent（M4 落地后生效）
pnpm --filter @agent-engine/cli run agent run \
  --config agents/devops-agent.yaml
```

---

## 12. 测试策略

- **目录约定**：每个包的测试统一放在该包的 `tests/` 目录（如 `packages/config/tests/`），文件以 `.test.ts` 结尾；**不在 `src/` 内混放测试**。
- **单元测试**：`core` 各模块（tools、memory、hooks、rules、config loader/schema）。
- **集成测试**：用一个最小 `AgentConfig` 跑通完整 Agent Loop（mock LLM）。
- **契约测试**：三种配置格式（YAML/JSON/TS）加载后产出等价的 `AgentConfig`。
- **端到端测试**：连接真实 MCP server 与 mock 模型，验证 tool 归一化与调用链路。

---

## 13. 部署（Docker）

### 13.1 本地基础设施（可复用镜像）

本机已具备以下基础设施镜像，作为各「可插拔后端」的具体落地，直接纳入 compose 编排，无需重复部署：

| 镜像                                            | 项目用途                                     |
| ----------------------------------------------- | -------------------------------------------- |
| `pgvector/pgvector:pg16` + `postgres:16-alpine` | 长期记忆向量后端（生产默认）                 |
| `ollama/ollama:latest`                          | 本地 LLM 推理（**后期可选**接入，非默认）    |
| `redis:7-alpine`                                | 会话缓存 / 消息队列 / 分布式锁               |
| `minio/minio:latest`                            | 对象存储（文件、artifact 持久化）            |
| `getmeili/meilisearch:latest`                   | 全文 / 语义检索（可选）                      |
| `prom/prometheus` + `grafana/grafana`           | 可观测性（pino/OTel → Prometheus → Grafana） |
| `nginx` / `caddy:2-alpine`                      | 反向代理网关（webApp + server）              |

> 其余本地镜像（`infra-*`、`sandbox-*`、`yjs-docs-*`、`nacos`、`envoy`、`kindest` 等）属于其他项目，本仓库不纳入。

### 13.2 容器构建

- 多阶段构建：`node:20-alpine` → 安装依赖 → 构建 → 精简运行时镜像。
- 配置通过 **卷挂载** `agents/` 目录，支持不改镜像即热更新 Agent。
- 服务由 `@agent-engine/server` 对外提供 HTTP API，`cli` 用于交互/批处理。

```yaml
# docker-compose.yml（示意）
services:
  server:
    build: ./docker
    ports: ['8080:8080']
    volumes:
      - ./agents:/app/agents:ro
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - DATABASE_URL=postgres://agent:agent@pgvector:5432/agent
      - REDIS_URL=redis://redis:6379
    depends_on: [pgvector, redis]

  web:
    build: ./apps/web
    ports: ['3000:80']

  pgvector:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: agent
      POSTGRES_PASSWORD: agent
      POSTGRES_DB: agent

  redis:
    image: redis:7-alpine
```

---

## 14. 下一步里程碑（建议）

1. **M1 内核骨架**：monorepo 搭建（tsdown 构建）+ `config` 包（Schema + 三格式加载）+ `core` 包（LLM Provider 抽象——**默认接 DeepSeek**、Tool 注册表、单 Agent Loop）。
2. **M2 配置化能力**：hooks、rules、skills、plugins 系统 + system-prompt 组装 + 会话 memory。
3. **M3 扩展接入**：MCP client、长期记忆后端（pgvector）、多 Agent 编排。
4. **M4 服务化**：server（HTTP API）+ CLI。
5. **M5 平台与文档**：apps/web 一体化平台 + docs（Rspress）+ Docker 编排 + 示例垂直领域 Agent。
