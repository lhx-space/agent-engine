## Context

`ToolRegistry` 机制已在 `add-tool-registry` 落地（`Tool` 接口 + `execute` 参数校验 + Zod→JSON Schema），`execution-sandbox` 提供了 `SandboxBackend`（docker/nsjail）。本 change 补上五个内置工具，使「配置即 Agent」真正可跑。

内置工具是「开箱即用能力」的基线（AGENTS.md 5.1 tools 是原子能力单元），也是后续 mcp / skills / plugins 工具与内置工具「平级」注册进同一 Registry 的示范。

## Goals / Non-Goals

**Goals:**

- 落地 `todo` / `read_file` / `write_file` / `bash` / `web_search` 五个内置工具。
- 策略执行：bash 白/黑名单、文件路径约束（含 symlink 逃逸防护）、web domain 约束。
- 统一装配入口，bash 默认禁用。

**Non-Goals:**

- 不实现 Task Planner 内核策略（plan-execute 等）——任务规划由 `todo` 工具 + prompt 涌现（AGENTS.md 6.2）。
- 不实现真实搜索引擎接入（Bing/SerpAPI 等）——`web_search` 用可配置 endpoint + fetch，留 M3。
- 不实现文件 diff / 增量编辑 / 目录遍历等高级 fs 能力——保持原子工具最小集。

## Decisions

### D1: 内置工具用 `builtin.<name>` 命名空间

**选择**：工具名为 `builtin.read_file` / `builtin.write_file` / `builtin.bash` / `builtin.web_search` / `builtin.todo`。

**理由**：与配置 `tools: [{ use: builtin.read_file }]`（AGENTS.md 7.2）对齐，与 mcp/plugin 工具在注册表内平级但命名可辨。

### D2: `todo` = 内存 TodoStore + 单工具多 action

**选择**：`createTodoTool(store)` 返回一个工具，`inputSchema` 用 `z.discriminatedUnion('action')` 分派 `add` / `list` / `update` / `delete`；`TodoStore` 内存态，item 含 `id` / `task` / `status`（pending / in_progress / completed）。

**理由**：单工具多 action 让 LLM 用一个工具即可完成计划管理，减少工具面；规划是「工具 + prompt 涌现」，内核零改动（AGENTS.md 6.2）。

### D3: 文件工具路径约束（workspaceRoot + realpath）

**选择**：`resolveWithinRoot(root, path)`：`path.resolve` 后再 `fs.realpath` 解析，校验结果以 `root + sep` 为前缀，否则拒绝；根外 / `..` / symlink 逃逸一律 deny。

**理由**：防路径穿越与 symlink 逃逸（如 `/workspace/link -> /etc`），不依赖 OS 沙箱即可约束文件工具爆炸半径。

### D4: bash 策略在工具内兜底执行

**选择**：`createBashTool(policy, sandbox)`：`policy.enabled=false` 时上层不注册；执行时先查 `allowCommands`（白名单，空数组 = 不启用白名单）与 `denyPatterns`（黑名单，子串/正则命中即拒绝），通过后才 `sandbox.exec`；`allowNetwork` 映射到 `network`。

**理由**：策略（allow/deny）与隔离（sandbox）分层；策略在工具内自包含、可单测，同时与 AgentLoop 已有的 guardrail `beforeToolCall` 互补（用户可再叠加规则）。

### D5: `web_search` 用可注入 fetch + endpoint

**选择**：`createWebSearchTool(policy, fetchImpl = globalThis.fetch)`：拼 `endpoint?q=query`，执行前对 endpoint host 做 domain 白/黑名单校验，超时 + 截断。

**理由**：`fetch` 注入便于测试（假 fetch），无真实搜索引擎依赖；domain 约束收敛在配置。

### D6: `registerBuiltinTools` 统一装配

**选择**：`registerBuiltinTools(registry, security, deps)`：todo/read_file/write_file/web_search 恒注册；bash 仅 `security.bash.enabled` 时注册，且 `deps.sandbox` 不可用则抛可读错误。

**理由**：单一装配入口，调用方（assembleAgentLoop / CLI / server）零散注册逻辑；bash 安全默认（禁用 + 无沙箱即报错）。

### D7: 无新增三方依赖

**选择**：`node:fs` / `node:child_process` / 全局 `fetch` 实现，不引 npm 库。

**理由**：复用 Node 内置能力，符合「复用优先，拒绝重复造轮子」。

## Risks / Trade-offs

- [symlink 逃逸] → `realpath` 解析后前缀校验，覆盖主要 TOCTOU 路径；更强隔离（容器内 fs）留 M3。
- [web_search 无真实搜索后端] → M2 用可配置 endpoint + fetch（默认需配置 endpoint），搜索引擎接入留 M3。
- [bash 白名单误拦] → 空白名单 = 不启用白名单（仅黑名单生效），文档说明。
- [todo 状态非持久化] → 内存态随会话结束消失；持久化到 memory 后端留 M3。

## Migration Plan

无迁移。纯新增工具；`security.bash.enabled` 默认 false 保证向后兼容（旧配置无 bash 能力）。
