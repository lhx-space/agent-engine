# 系统架构设计

> 本文档描述 Agent Engine 的整体架构、模块边界、数据流与关键设计决策。架构变更必须更新本文档，并走评审。

## 目录

1. 架构总览
2. 模块划分与职责
3. 依赖方向
4. 核心数据流
5. 「目录即 Agent」机制
6. 多模型与容错
7. 安全边界
8. 部署拓扑

## 一、架构总览

````text
                ┌──────────────────────┐
      用户 ─────▶│     Next.js 宿主      │  (agents/ 目录)
                │  扫 .lhx-agent 拼协议   │
                └──────────┬───────────┘
                           │ AgentConfig（协议化数据源）
                           ▼
                ┌──────────────────────┐
                │      内核 harness     │  (core)
                │ AgentLoop / 装配 / 协议 │
                └──────────┬───────────┘
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
   │ PostgreSQL   │  │    Redis     │  │  外部 MCP    │
   │  (pgvector)  │  │    (缓存)    │  │  (远程服务)  │
   └─────────────┘  └─────────────┘  └─────────────┘
```text

## 二、模块划分与职责

| 层 | 包 | 职责 |
| --- | --- | --- |
| 配置层 | `@lhx-agent-engine/config` | Zod schema + YAML/JSON/TS 三格式加载 + 安全防线（sanitize/deepFreeze） |
| 内核层 | `@lhx-agent-engine/core` | AgentLoop、装配（assemble/resolve）、hooks/guardrails 协议、可插拔后端抽象 |
| 能力插件 | `@lhx-agent-engine/plugin-*` | rules/skills/documents/memory/web/mcp/guardrails/files/bash/git/otel/pgvector/redis |
| 聚合层 | `@lhx-agent-engine/preset-default` | 聚合全部插件工厂 + 按 config 切片激活 |
| 服务层 | `@lhx-agent-engine/server` | HTTP API（REST + NDJSON 流式）+ 会话复用 |
| 宿主层 | `agents/` | Next.js 扫目录拼协议 + 对话 UI |

## 三、依赖方向

```text
config ← core ← cli / server ← plugins
```text

- **单向依赖**，禁止反向/循环。
- 内核不读 `process.env`（密钥由宿主层注入）、不读目录（目录是宿主层概念）、不解释 config 的领域字段（rules/skills 等由插件解释）。

## 四、核心数据流

1. 用户在宿主对话页提问。
2. 宿主 `scanAgentDir(name)` 扫 `.lhx-agent/<name>/` 目录 → 拼 `AgentConfig`（含 `${VAR}` 运行时插值）。
3. `resolveAgentConfig` 装配：LLM provider（路由 → 容错 → 缓存）+ 插件 + 后端（pgvector/redis）。
4. `AgentLoop.run(input)` 执行 ReAct 循环：
   - 组装上下文（systemPrompt + rules + skills + documents + 长期记忆召回）。
   - LLM 调用（可能触发工具调用）。
   - 执行工具：files 宿主直读 / bash·git 沙箱隔离 / MCP 外部服务。
   - guardrails 拦截 / hooks 观察改写。
   - 结果回填，进入下一轮，直到 `finishReason=stop` 或达预算。
5. 长期记忆写入 pgvector，LLM 响应缓存进 redis。

## 五、「目录即 Agent」机制

一个 agent = 一个目录，文件即配置：

```text
.lhx-agent/<name>/
├── context/system.md       # frontmatter 标量（name/model/plugins/...）+ systemPrompt 正文
├── context/knowledge/*.md  # documents 知识源
├── rules/*.mdc             # 每条规则一个文件（frontmatter: kind/description/tags）
├── skills/<skill>/SKILL.md # 每个 skill 一个目录
├── hooks/*.ts              # 每个 hook 一个文件（jiti 加载）
└── mcps/*.yaml             # 每个 MCP server 一个文件
```text

核心原则：**内核只认一份 `AgentConfig` 协议；YAML/JSON/目录/网页/数据库都是「现实形式」，由宿主层归一化成协议**。协议相同走「路由/容错」，协议不同才分「槽」（chat vs embedding vs vision）。

## 六、多模型与容错

- **能力槽**：`model`（chat）、`embedding`（向量）顶层分开。
- **路由**：`model.routes` 按复杂度（`minInputTokens`）/ 能力标签（`capabilities`）切换模型。
- **容错**：`model.fallbacks` 主模型失败重试耗尽后依次降级（5xx/429/网络重试，4xx 不重试）。
- **缓存**：LLM 响应缓存（同请求命中不重复调模型），缓存后端可插拔（in-memory / redis）。

## 七、安全边界

| 能力 | 边界 |
| --- | --- |
| 读文件（files） | 宿主直读 + `roots` 白名单（realpath 越界校验） |
| 执行命令（bash/git） | docker 沙箱隔离（断网、只读、降权、资源限制） |
| 阻断 | guardrails 声明式拦截（deny tools / deny patterns） |
| 观察/改写 | hooks（只观察/改写，不阻断） |
| 外部输入 | MCP 结果、网页、文档视为不可信，经 guardrails 校验 |

## 八、部署拓扑

- 本地：`docker compose up`（pgvector + redis）+ Next.js 宿主（`.env.local` 配 `WORKSPACE_ROOT`）。
- 云端：代码挂载到容器 `/workspace`，`WORKSPACE_ROOT=/workspace`；基础设施走云托管或同 compose。
- 沙箱镜像 `agent-engine/sandbox` 独立构建，bash/git 按需 `docker run`。
````
