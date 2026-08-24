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
| 构建        | tsdown + Turborepo                            | tsdown 出 ESM/CJS + d.ts；Turborepo 编排 + 本地缓存（turbo.json）                 |
| 代码检查    | Rslint（Go 引擎，兼容 ESLint/TS-ESLint 规则） | 快，内置 TypeScript-ESLint 规则                                                   |
| 格式化      | Prettier                                      | 统一代码风格                                                                      |
| 拼写检查    | cspell                                        | 术语一致性                                                                        |
| Markdown    | markdownlint-cli2                             | 与 Prettier 互补（Prettier 排版 / markdownlint 规则）                             |
| 类型检查    | tsc --noEmit                                  | 全仓类型检查                                                                      |
| Git hooks   | husky + lint-staged + commitlint              | 提交前自动检查 + 提交信息校验                                                     |
| 测试        | Rstest                                        | web-infra-dev 生态，API 兼容 Vitest（`vi`→`rs`）                                  |
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
>
> 说明：缓存同样是**可插拔后端**——内核定义 `CacheBackend` 抽象接口（`get` / `set` / `delete` / `clear` + TTL），开发默认 `in-memory`，生产默认 `redis`（本地已有 `redis:7-alpine` 镜像）。LLM 响应、检索结果、会话状态等各层复用同一缓存抽象。

### 3.1 框架选型：自研内核 + SDK 复用（不引入 LangChain）

**结论**：执行内核自研，能力层全部复用官方 SDK；不引入 LangChain / LangGraph 等重型编排框架。

理由：

1. **内核即核心资产**：本项目价值在于「可配置化的执行引擎」，hooks（可拦截/阻断）、rules（上下文约束）、guardrail（安全拦截）是第一等公民。LangChain 的抽象（Runnable/Chain/AgentExecutor）反而束缚对执行链路的精细控制，套框架需额外写 adapter。
2. **稳定性风险**：LangChain.js 版本迭代频繁（v0.1 → v0.3 多次破坏性变更），不宜作为长期内核依赖。
3. **自研的是「胶水层」，非重复造轮子**：循环 + 编排 + 装配本质是少量胶水代码，无现成库能直接满足「八大项全可配置」；有成熟库的部分一律复用，不违背「复用优先」。

边界清单：

| 复用（用库，不自己写）                               | 自研（核心资产）                  |
| ---------------------------------------------------- | --------------------------------- |
| `openai` / `@anthropic-ai/sdk`（LLM）                | Agent Loop（ReAct）               |
| `@modelcontextprotocol/sdk`（MCP）                   | 多 Agent 编排器                   |
| `zod` / `yaml` / `json5` / `jiti`（配置）            | Plugin 系统、Hook 管线、Rule 引擎 |
| `pgvector` / `ioredis` / `minio`（后端）             | system-prompt 组装、memory 薄层   |
| `@mozilla/readability` + `linkedom`（HTML 正文提取） | ——                                |
| `expr-eval`（表达式求值，calculator）                | ——                                |
| `pino` / OTel（可观测）                              | 配置归一化 resolve                |
| `rtk`（命令输出压缩，沙箱镜像内二进制）              | ——                                |
| React 生态 / Monaco / React Flow（Web）              | ——                                |

> 一句话：**库（SDK）照用，框架（LangChain）不引入。**

---

## 4. 目录结构（monorepo）

```text
agent-engine/
├── CLAUDE.md                  # Claude Code 入口说明（@本文件）
├── AGENTS.md                  # 本文件，权威文档
├── package.json               # 根 scripts + 共享 devDependencies
├── pnpm-workspace.yaml        # workspace：packages/* / apps/* / docs
├── tsconfig.base.json         # 共享 TS 配置（strict）
├── turbo.json                 # Turborepo 构建缓存编排
├── rslint.config.ts           # 代码检查（Rslint，ESLint flat config 兼容）
├── .prettierrc                # 格式化（Prettier）
├── cspell.json                # 拼写检查
├── .markdownlint-cli2.jsonc   # Markdown 质量检查（markdownlint）
├── commitlint.config.mjs      # 提交信息校验（Conventional Commits）
├── lint-staged.config.mjs     # 暂存文件提交前检查
├── rstest.config.ts           # 测试配置（Rstest）
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
│   │       ├── agent/         #   Agent Loop（单 Agent 原语；多 Agent 编排在独立 orchestration 包，M3）
│   │       ├── capability/    #   CapabilityBundle 统一能力束 + mergeBundles 汇聚
│   │       ├── resolve/       #   resolveAgentConfig（AgentConfig→AgentLoop 一键装配）
│   │       ├── llm/           #   Provider 抽象（OpenAI/Anthropic/自定义）
│   │       ├── tools/         #   Tool 注册表与执行器
│   │       │   ├── builtin/   #   内置工具（todo/read/write/bash/web/sitesearch/calculator/...）
│   │       │   └── utils/     #   非 tool 支撑（http/搜索/路径/domain/html/store/policy）
│   │       ├── sandbox/       #   SandboxBackend（docker / nsjail 执行沙箱）
│   │       ├── memory/        #   会话上下文 + 长期记忆抽象
│   │       ├── skills/        #   Skill 加载/注册/触发
│   │       ├── plugins/       #   插件系统与 PluginContext
│   │       ├── hooks/         #   生命周期钩子管线
│   │       ├── rules/         #   上下文规则加载/检索 + guardrail 拦截
│   │       ├── context/       #   system-prompt 组装、上下文窗口管理
│   │       ├── retrieval/     #   统一能力检索（CapabilityRegistry / CapabilityLoader，BM25）
│   │       ├── mcp/           #   MCP client 接入（stdio transport）
│   │       ├── events/        #   事件总线、可观测（M3 规划）
│   │       └── types.ts       #   对外核心类型
│   ├── config/                # @agent-engine/config —— 配置加载 + Schema
│   │   └── src/
│   │       ├── schema/        #   Zod Schema（AgentConfig 等）
│   │       ├── loader/        #   yaml/json5/jiti 加载器
│   │       └── resolve/       #   配置级归一化（env 插值 / $ref / extends，后续）
│   ├── cli/                   # @agent-engine/cli   —— 命令行入口
│   ├── server/                # @agent-engine/server —— HTTP 服务（Docker 部署）
│   └── plugins/               # 内置插件（otel、git 等）
├── examples/                  # 垂直领域 Agent 配置示例
│   ├── devops-agent/
│   └── code-review-agent/
├── agents/                    # 运行时挂载的 agent 配置目录（Docker 卷挂载点）
└── docker/
    ├── Dockerfile
    └── docker-compose.yml
```

### 依赖方向（保持单向，避免循环依赖）

```text
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

### 5.0 目录 → 层 映射

依赖方向：**上层依赖下层，反向禁止**（包级已锁 `config ← core ← cli/server`）。

| 层                         | 模块（`core/src/`）                                 | 职责                             |
| -------------------------- | --------------------------------------------------- | -------------------------------- |
| 引擎层                     | `agent/`（loop / assemble）、`llm/`                 | 执行循环 + 模型接入              |
| 能力层（横向拓展）         | `tools/`、`skills/`、`mcp/`                         | 原子能力 / 能力包 / 外部能力来源 |
| 扩展层                     | `plugins/`                                          | 能力的打包与分发                 |
| 控制层                     | `hooks/`、`rules/`（guardrail）                     | 生命周期拦截 + 规则约束          |
| 上下文层                   | `context/`（system-prompt）、`memory/`              | 提示词组装 + 会话/长期记忆       |
| 基建层（leaf，被上层依赖） | `sandbox/`、`retrieval/`、`capability/`、`resolve/` | 隔离 / 检索 / 能力束 / 装配      |

> 目录是「呈现」不是「约束」：真正的分层靠依赖方向与未来的 import 边界 lint，而非目录嵌套深度。

### 5.1 能力层（Agent 能「做什么」）

- **tools**：原子能力单元，一个函数即一个工具（如 `read_file`、`bash`、`web_search`）。注册进 **Tool Registry**。已落地内置工具 `todo` / `read_file` / `write_file` / `bash` / `web_search` / `web_fetch` / `sitesearch` / `calculator` / `datetime` / `json` / `base64`（`core/tools/builtin/`），其中 `bash` 默认禁用、经 `SandboxBackend` 沙箱执行（见 5.6）；非 tool 的支撑代码（http/搜索后端/路径/domain/html/store/policy）统一在 `core/tools/utils/`。
- **skills**：可复用能力包 = 一份指令（`SKILL.md`）+ 可选捆绑的 tools/资源。按需动态加载，加载后将其指令注入上下文、工具并入注册表。已落地 `Skill` 类型 + 统一 `CapabilityLoader`（BM25 检索，复用 `CapabilityRegistry`）+ `loadSkillFromPath`（gray-matter 解析 SKILL.md）；`AgentLoop.skills` 注入后按需注入指令 + 注册捆绑工具。
- **mcp**：通过 Model Context Protocol 接入的**外部能力来源**。一个外部 MCP server 的 `tools/resources` 会被归一化为标准 Tool，纳入同一注册表，内核无感知差异。已落地 `core/mcp/`（`connectMcpServer` / `connectMcpServers`，stdio transport 复用 `@modelcontextprotocol/sdk`，tools 归一化为标准 Tool + `jsonSchema` 透传 + 错误隔离 + `dispose` 生命周期）；配置 `mcp.servers`（name/command/args/env）由 resolve 层装配。

### 5.2 扩展层（能力的「打包与分发」单元）

- **plugins**：最大的扩展单元，可打包「多个 tools + skills + hooks + rules + memory 后端 + system-prompt 片段」整体注册/卸载。插件通过 `PluginContext` 注入能力，是实现「开箱即用领域能力」的载体。已落地 `Plugin` 类型 + `PluginContext`（registerTool / registerSkill / registerHook / registerRule / provideSystemPrompt）+ `PluginManager`（install → `CapabilityBundle`）+ `assembleAgentLoop`（async 装配工厂，安装 plugins 并合并能力）；内置插件 `@agent-engine/plugin-git`（git 工具套件，只读默认、破坏性子命令阻断、经沙箱执行，`packages/plugins/git/`）。

### 5.3 执行控制层（Agent「如何做」的约束）

- **hooks**：生命周期事件拦截点，用于无侵入地增强执行流程（日志、审计、限流、埋点、内容过滤）。
- **rules**：上下文规则，作为「约束文本」注入 system-prompt，按 `kind` 决定加载策略——`always` 强制注入 / `on-demand` 按需检索（BM25）注入；每条规则 = `id` + `description`（匹配面）+ `content`（markdown 正文）+ `tags`（同义词）。
- **guardrail（安全拦截，独立于 rules）**：在关键节点（如 `beforeToolCall` / `afterToolCall`）做拦截与校验、可阻断危险行为的**可执行代码**（`RuleRegistry` / `GuardrailRule`），与「配置文本类 rules」分离。

### 5.4 上下文层（Agent「知道什么」）

- **system-prompt**：系统提示词，由「模板 + 变量 + 各模块（skills/rules/plugins）注入的片段」组装而成。组装已落地 `context` 模块：`buildSystemPrompt({ systemPrompt, rulesText, skillsText })` 做模板渲染（`renderTemplate`，`{{var}}` 正则替换、未提供变量保留原样、null/undefined 空串）+ rules / skills 注入（`rules` / `skills` 为内置变量，模板用 `{{rules}}` / `{{skills}}` 占位符声明注入点，未声明时兜底追加）；检索由 AgentLoop 用统一 `CapabilityLoader` 完成。`AgentLoop.systemPrompt` 支持三种形态——静态字符串 / `SystemPrompt` 模板对象（配 `rules` 每次 `run` 内建检索注入）/ 函数式（完全自定义），每次 `run` 动态解析，使 rules 按需检索结果真正进入 system prompt。
- **memory**：记忆管理，分两层：
  - **会话上下文**：单次会话的 message 窗口管理（含窗口裁剪）。已落地 `ConversationMemory`（历史管理 + `maxMessages` 窗口裁剪，不存 system——system 每次 run 动态组装）；`AgentLoop.memory` 选项注入后跨 run 累积历史实现多轮对话（异常不回写）。
  - **长期记忆**：跨会话的持久化 + 向量检索（可选，后端可插拔，M3）。

  > **已知局限与演进方向（M3）**：当前窗口裁剪是「按条数从头丢弃」，两个问题——(1) 条数 ≠ token 预算，裁剪粒度失控；(2) 可能拆散 assistant `tool_call` 与后续 `tool` 结果的配对，导致下一轮请求非法。演进为**三层记忆**：① 正确截取（token 预算 + 整轮边界淘汰，绝不拆散配对）→ ② 压缩层（滚动摘要，LLM 摘要旧轮）→ ③ 语义层（embedding 向量化 + pgvector 召回，长期记忆）。

### 关系速记

```text
plugin（分发单元，最大）
  ├── 可打包 → skill（能力包）→ tool（原子能力）
  ├── 可打包 → hooks / rules / memory 后端 / prompt 片段
  └── 可声明依赖

mcp → 外部 server → 归一化为 tool（与内置 tool 平级）

system-prompt ← 模板 + variables + skills/rules/plugins 注入片段
memory       ← 会话上下文 + 长期记忆（后端可插拔）
```

### 5.5 统一能力检索调度（Capability Registry）

rules / skills / mcp tools / plugins 共享「**meta + 按需加载**」的机制，统一为一个「能力发现 + 调度」pipeline：

- **统一 meta**：每个能力都有 `id` + `description`（匹配面），注册进统一的 `CapabilityRegistry`。
- **BM25 检索召回**：user input 进来后，用 BM25 对 meta（description）打分，召回 **top-k** 相关能力——避免让 LLM 理解全部能力（token 爆炸 + 注意力分散）。
- **LLM 有限范围理解**：只把 top-k 候选给 LLM 理解/选择，而非全量。
- **差异加载**：检索层统一（meta + BM25），加载层按 `type` 分派——rule 注入 content 文本、skill 注入 SKILL.md + 捆绑工具、mcp 注册工具到 ToolRegistry、plugin 注册能力。
- **加载策略（kind）**：`always`（强制加载，绕过检索）与 `on-demand`（参与 BM25 检索）。

> 这个统一 pipeline 是 rules / skills / mcp / plugins 复用的「套壳」机制；先以 rules 落地验证（content 为纯文本最简），再推广到 skills / mcp / plugins。

**首版范围（M2）**：

- `CapabilityRegistry` 统一 meta：`id` + `type` + `description`（匹配面）+ `tags`（同义词，缓解漏检）。
- BM25 检索召回 top-k，**输出每个能力的得分**（可观测，排查漏召回）。
- 加载策略 `always`（强制，绕过检索）/ `on-demand`（参与 BM25 检索）。
- **C1 空集合兜底**：无候选时告知「无可用能力」或退化为「无规则注入」。
- rules 第一个接入（content 纯文本最简），skills 第二个接入（指令注入 + 捆绑工具注册）。

**后续演进（M3+，明确延后）**：

- RRF 融合召回（BM25 + embedding，依赖 M3 的 embedding 模型）。
- Reranker 重排序、记忆反馈（历史调用增强查询）、动态 k、缓存、权限校验（meta 预留 tags 字段）。

**坑点对策**：

- **召回漏检**：meta 加 `tags`（同义词）；向量融合留 M3。
- **meta 质量是检索核心**：`description` 要精准、不过短不过冗长。
- **C1 空集合**：必须有兜底分支。

### 5.6 执行沙箱（Execution Sandbox）

内置 `bash` / `write_file` 本质是把「任意命令执行 / 任意文件写入」交给一个不可完全信任的模型，存在 prompt injection 风险。只靠 prompt/rules 是软约束，必须有**不依赖模型自觉的硬边界**——四层防御：

| 层                | 机制                                               | 职责                                                          |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| 0 配置层权限      | `security` 声明式 allowlist                        | 决定「允许做什么」（bash 白/黑名单、文件 roots、web domains） |
| 1 Guardrail 拦截  | `beforeToolCall` 可执行校验                        | 执行前阻断（路径越界 / 命中黑名单），复用 5.3 guardrail       |
| 2 Sandbox 隔离    | `SandboxBackend` 可插拔                            | 决定「爆炸半径」，进程跑在受限环境                            |
| 3 资源限制 + 审计 | timeout / cpu / mem / pids / 输出截断 + hooks/OTel | 代价可控 + 可追溯                                             |

- **`SandboxBackend` 接口**（`core/sandbox/`）：只暴露 `exec(req)`，聚焦「隔离执行原生命令」；`SandboxExecRequest` 声明 `timeoutMs` / `maxOutputBytes` / `network` / `limits`。
- **双后端**：`docker`（跨平台含 macOS，`docker run` 加固：`--network none --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit --memory --cpus --user`）+ `nsjail`（Linux，补「无 Docker」场景）；`auto` 探测：docker 可用 → docker，否则 Linux 且 nsjail 可用 → nsjail，否则「不可用」。
- **安全默认**：`bash.enabled` 默认 `false`；**沙箱不可用即禁用，绝不回退宿主进程裸奔**。
- **复用优先**：沙箱复用系统二进制 `docker` / `nsjail`（`node:child_process` 驱动），不引第三方 npm 沙箱库、不自研沙箱。
- **输出压缩（rtk）**：`security.sandbox.compact`（默认 false）开启后，docker / nsjail 后端以 `rtk` 包装命令（`rtk <cmd>`）压缩输出省 token；rtk 是沙箱镜像内的系统二进制（复用 [Rust Token Killer](https://github.com/rtk-ai/rtk)，不自研）。
- **WASM/WASI 边界（明确分离）**：WASI 沙箱的是「编译成 wasm 的代码」，**不能**沙箱原生 `bash`/`kubectl`/`git`。不可信**用户代码/工具函数**的沙箱是另一个正交需求，留 M3 立 `FunctionSandbox`（wasmtime/wasmer，零 Docker 依赖），**不要用 wasm 替代 bash 的沙箱**。

> 落地矩阵：`bash` 沙箱 = 有 Docker 用 docker；Linux 无 Docker 用 nsjail；macOS 无 Docker 则禁用 bash（只保留 read/write/web_search/todo）。

---

## 6. 内核执行引擎

### 6.1 单 Agent 执行循环（ReAct）

```text
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
   │    ├─ guardrail 动态校验
   │    ├─ hooks.beforeToolCall
   │    ├─ 执行 tools（含 MCP 归一化工具）
   │    ├─ hooks.afterToolCall
   │    └─ 结果回填 messages，进入下一轮
   └─ 否则：
        └─ 产出最终结果，退出循环

 └─ hooks.onSessionEnd
```

### 6.2 任务规划（Task Planner）

Task Planner 不是内核的一等公民，而是「工具 + 编排」的自然涌现——**能配置解决的不改内核**。

- **单 Agent 场景（ReAct + 工具引导）**（✅ 已落地）：提供内置 `todo` 工具 + `assembleAgentLoop` 注册 todo 时自动注入「复杂任务先列计划再执行」引导片段，LLM 在现有 ReAct 循环内自然完成规划，内核零改动。
- **多 Agent 场景（orchestrator 即规划者）**：主 Agent 天然承担规划职责，`spawn` 子 Agent 执行子任务，任务分解在多 Agent 编排中自然涌现（见 6.3）。
- **内核 plan-execute 策略（不作为默认）**：仅在需要「严格计划跟踪 / 自动 replan」时，才考虑在 orchestration 中引入 `strategy: plan-execute`，作为 ReAct 的可选增强。

### 6.3 多 Agent 编排

- **orchestrator + subagents**：主 Agent 可 `spawn` 子 Agent，支持顺序/并行执行，结果汇总回主 Agent。
- 编排拓扑通过配置声明（如 `orchestration: { mode: "sequential" | "parallel" | "graph" }`）。
- 每个 subagent 可拥有独立的 system-prompt / tools / memory 作用域。

### 6.4 生命周期钩子（hooks）清单

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

> 落地状态：已实现 6 个循环级/错误级 hook（`beforeLLM` / `afterLLM` / `beforeToolCall` / `afterToolCall` / `onStepEnd` / `onError`）；`onInit` / `onSessionStart` / `onSessionEnd` 三个装配级/会话级 hook **待补齐**（在 `Hook` 接口与 assemble/loop 中触发）。

hooks 是内核执行流程的**有限生命周期锚点**，不会随模块膨胀：

- **模块复用而非新增**：guardrail（走 beforeToolCall）、skill（触发走 beforeLLM）、memory（写入走 afterLLM / afterToolCall）、plugin（日志走任意锚点）都**复用**现有钩子点，不各自发明「rule hook」「skill hook」。
- **模块特定事件走 events 总线**：需要「规则命中」「plugin 已装」「mcp 已连」等业务事件时，用 `events/` 事件总线（发布/订阅，见目录结构）而非扩充 hooks；`events/` 目录尚未建立（M3）。加载了哪些能力（plugins/rules/skills/mcp）的可观测同样走 events 总线 + pino 结构化日志，**不新增 per-module loading hook**。
- **分层钩子**：装配级（onInit）/ 会话级（onSessionStart/End）/ 循环级（beforeLLM…onStepEnd）/ 错误级（onError）；多 Agent 编排（M3）会有独立的**编排级钩子**（如 onSubagentStart/End），不与单 Agent 循环钩子混用。
- **职责边界**：hooks 负责「观察 + 改写（增强）」，**不做阻断**；阻断是 guardrail 的职责。

---

## 7. 配置系统

### 7.1 三种格式统一归一化

- **YAML**：默认推荐，运维友好、可读、支持注释与热加载。
- **JSON / JSON5**：程序化生成友好，支持注释。
- **TypeScript**：类型安全、可编程（通过 `jiti` 动态加载，`export default` 配置对象）。

三者加载后统一走 **Zod Schema 校验**，产出同一份 `AgentConfig`。内核只面向 `AgentConfig`。

> **配置加载安全（已落地）**：`loadAgentConfig(path, options?)` 内置四道防线——① TypeScript 配置默认拒绝（`allowTsConfig: true` 才经 jiti 执行，因 TS 配置本质是代码）；② 入口 `sanitizeConfigValue` 递归剔除 `__proto__`/`constructor`/`prototype` 防原型污染；③ 出口 `deepFreeze` 深度冻结产物防篡改；④ 资源限制（文件大小默认 1 MiB + YAML `maxAliasCount`/`uniqueKeys` 防别名炸弹与重复 key）。TS 格式仅用于受信任的本地开发输入。

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
    kind: always # 强制注入，绕过检索
    content: |
      禁止执行 rm -rf、DROP TABLE、DROP DATABASE 等破坏性命令；
      执行前须说明影响范围并征得确认。
    tags: [安全, 运维]
  - id: k8s-diagnosis
    description: Kubernetes 故障诊断规范
    kind: on-demand # 按需检索注入
    content: |
      排查顺序：kubectl get events → describe pod → logs → 逐层定位。
    tags: [k8s, kubernetes, 诊断]

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

security:
  sandbox:
    backend: auto # docker | nsjail | auto
    image: agent-engine/sandbox
    workspaceRoot: /workspace
    compact: false # 开启后经 rtk 压缩命令输出省 token（沙箱镜像需含 rtk）
  bash:
    enabled: true # 默认 false；开启后命令经沙箱执行
    allowCommands: [kubectl, git, ls, cat]
    denyPatterns: ['rm -rf', 'DROP TABLE', 'DROP DATABASE']
    allowNetwork: true # kubectl 需连集群，默认 false
    timeoutMs: 30000
    maxOutputBytes: 65536
  files:
    roots: [/workspace]
    maxFileBytes: 1048576
  webSearch:
    provider: duckduckgo # 搜索后端（可插拔：tavily / serpapi / searxng）
    maxResults: 8
  webFetch:
    allowDomains: []
    denyDomains: []

orchestration:
  mode: single # single | sequential | parallel | graph
```

### 7.3 多模型设计（能力分离 + 实例级覆盖）

模型配置遵循社区主流做法（借鉴 OpenAI Agents SDK / Claude Code / LlamaIndex）。关键：**「模型角色」是两个正交维度，不能混为一个角色字典**。

- **能力维度（顶层分字段）**：chat（推理 + tool call）与 embedding（向量化）是不同能力、不同接口、不同协议，**顶层分开**。默认推理模型用 `model`；向量模型用独立的 `embedding` 字段（做长期记忆时引入，M3）。
- **角色维度（实例级覆盖）**：subagent 用哪个模型，是在 **subagent 定义里覆盖**（如 `subagents[].model`），而非全局一个 `subagent model` 字段。
- **vision 多模态**：不配置，交给自定义工具（能力外置）。
- **接口边界**：`LLMProvider` 只覆盖 chat（chat completion）；embedding 是另一个抽象（`EmbeddingProvider`），不要塞进 `LLMProvider`。

---

## 8. 扩展机制

### 8.1 新增一个 tool

1. 在对应包中实现 `Tool` 接口（`name` / `description` / `inputSchema` / `execute`）。
2. 通过 `ToolRegistry.register()` 或配置文件 `tools` 段注册。
3. 覆盖 `inputSchema`（Zod），保证 LLM 可正确理解参数。

> 内置工具（`todo` / `read_file` / `write_file` / `bash` / `web_search` / `web_fetch` / `sitesearch` / `calculator` / `datetime` / `json` / `base64`）已提供（`core/tools/builtin/`），通过 `registerBuiltinTools` 统一装配；`bash` 默认禁用、经 `security` 段开启（见 5.6 / 7.2）。非 tool 支撑在 `core/tools/utils/`。

### 8.2 新增一个 skill

```text
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
  provideSystemPrompt(fragment: string): void;
  // registerMemoryBackend(backend: MemoryBackend): void; // M3 长期记忆后端
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
- **design.md（必写）**：每个 change 写 `Context` / `Goals / Non-Goals` / `Decisions` / `Risks / Trade-offs` / `Migration Plan`，记录关键取舍（架构分歧、复用 vs 自研、安全默认）。
- **一个 change 对应一个 commit**：active change（`openspec/changes/` 下、非 archive）在提交前必须处理——完成未归档、未完成未归档都视为失败；`scripts/check-openspec.mjs` 在 pre-commit 校验。
- **原则**：功能开发**先写 proposal/spec，再写代码**；禁止跳过规格直接改代码。
- OpenSpec 的 slash commands（`/opsx:*`）与 skills 已内置于 `.codebuddy/`。

---

## 11. 常用命令

```bash
pnpm install            # 安装依赖
pnpm build              # Turborepo 编排 + 缓存构建所有 packages
pnpm dev                # watch 模式开发（packages）
pnpm lint               # Rslint 代码检查
pnpm lint:fix           # Rslint 自动修复
pnpm format             # Prettier 格式化
pnpm format:check       # Prettier 格式校验
pnpm lint:md            # Markdown 质量检查（markdownlint）
pnpm lint:md:fix        # Markdown 自动修复
pnpm typecheck          # 全仓类型检查（tsc --noEmit）
pnpm spell              # cspell 拼写检查
pnpm test               # 运行测试（Rstest）
pnpm test:watch         # 监听模式
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

| 镜像                                            | 项目用途                                           |
| ----------------------------------------------- | -------------------------------------------------- |
| `pgvector/pgvector:pg16` + `postgres:16-alpine` | 长期记忆向量后端（生产默认）                       |
| `ollama/ollama:latest`                          | 本地 LLM 推理（**后期可选**接入，非默认）          |
| `redis:7-alpine`                                | 通用 CacheBackend / 会话缓存 / 消息队列 / 分布式锁 |
| `minio/minio:latest`                            | 对象存储（文件、artifact 持久化）                  |
| `getmeili/meilisearch:latest`                   | 全文 / 语义检索（可选）                            |
| `prom/prometheus` + `grafana/grafana`           | 可观测性（pino/OTel → Prometheus → Grafana）       |
| `nginx` / `caddy:2-alpine`                      | 反向代理网关（webApp + server）                    |

> 其余本地镜像（`infra-*`、`sandbox-*`、`yjs-docs-*`、`nacos`、`envoy`、`kindest` 等）属于其他项目，本仓库不纳入。
>
> `bash` 沙箱使用本仓库自建的精简镜像 `agent-engine/sandbox`（`docker/` 下构建），与上表第三方 `sandbox-*` 镜像无关；`SandboxBackend` 抽象下 docker / nsjail 双后端可选（见 5.6）。镜像需含 `git` 与 `rtk`（`security.sandbox.compact` 开启时经 rtk 压缩命令输出省 token）。

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

1. **M1 内核骨架**（✅ 已完成）：monorepo 搭建（tsdown 构建）+ `config` 包（Schema + 三格式加载）+ `core` 包（LLM Provider 抽象——**默认接 DeepSeek**、Tool 注册表、单 Agent Loop）。
2. **M2 配置化能力**（✅ 已完成）：hooks、rules、skills、plugins 系统 + system-prompt 组装 + 会话 memory + 内置工具（`todo` / `read_file` / `write_file` / `bash` / `web_search` / `web_fetch` / `sitesearch` / `calculator` / `datetime` / `json` / `base64`）+ 执行沙箱（`SandboxBackend`：docker / nsjail 双后端，bash 默认禁用，rtk 输出压缩）+ `@agent-engine/plugin-git`。
3. **M3 扩展接入**（**进行中**）：✅ ① MCP client（`connectMcpServer`/`connectMcpServers`，stdio transport）；✅ ④ config resolve 层（`resolveAgentConfig`：AgentConfig→AgentLoop 一键装配 + `CapabilityBundle` 统一）。剩余：② 长期记忆后端（pgvector，三层记忆）；③ 多 Agent 编排（独立 `@agent-engine/orchestration` 包）；⑤ FunctionSandbox（WASM/WASI）。此外待补齐：流式输出（`llm-streaming`）、`onInit`/`onSessionStart`/`onSessionEnd` 三个 hook、`events/` 事件总线 + pino 接线。
4. **M4 服务化**：server（HTTP API）+ CLI。
5. **M5 平台与文档**：apps/web 一体化平台 + docs（Rspress）+ Docker 编排 + 示例垂直领域 Agent。

### 复盘纪要（截至 M2 收尾）

M2 落地过程中沉淀的坑点与约定，后续开发直接复用：

- **Zod 默认值不级联**：`z.object({...}).default({})` 返回字面 `{}`，**不会**应用内层字段默认值——需显式给全量默认（`defaultSecurityConfig = SecurityConfigSchema.parse({})`）或子 schema 各自 `.default(全量)`。
- **LLM 工具 schema 用扁平结构**：`z.discriminatedUnion` 对 LLM 函数调用不够友好（分支匹配严格），工具入参改「`action` 枚举 + 可选字段」的扁平 schema，必需字段在执行期手动校验报错。
- **类型集中、职责分离**：类型定义集中文件顶部（`// ============ 类型 ============` 区），非 tool 的支撑代码（http/搜索/路径/domain/html/store/policy）下沉 `tools/utils/`，`builtin/` 只留工具工厂 + 装配。
- **路径约束两侧 realpath**：macOS 上 `/var → /private/var` 是符号链接，越界校验时 `roots` 与目标路径**都要** `realpath`，否则根内路径会被误判越界。
- **readability 需 DOM lib**：`@mozilla/readability` 依赖 DOM 类型，`core` 的 tsconfig 需 `lib: ["ES2023", "DOM"]`。
- **复用优先持续生效**：HTML 正文提取（readability+linkedom）、表达式求值（expr-eval）、命令输出压缩（rtk）均为成熟三方方案，未自研。
- **`__proto__` 是对象字面量的特殊语法**：`{ __proto__: x }` 是「设置原型」而非「自有属性」；测试/构造带危险 key 的对象须用 `JSON.parse('{"__proto__":...}')`，断言用 `Object.prototype.hasOwnProperty.call(obj, '__proto__')` 而非 `'__proto__' in obj`（`in` 会命中 `Object.prototype` 上的访问器）。
- **`yaml` v2 把 `__proto__` 解析为自有属性（安全）**，但 `sanitizeConfigValue` 仍「重建为全新普通对象」兜底，即便源对象原型被污染也能隔离；`deepFreeze` 是浅冻结，须递归 + WeakSet 防环 + 跳过非 plain 值（Date/Map/类实例）。
- **配置加载即信任边界**：TS 配置会被当作代码执行（jiti），默认拒绝、显式 `allowTsConfig` 才开，仅限本地受信任输入；生产/热挂载只走 YAML/JSON。
