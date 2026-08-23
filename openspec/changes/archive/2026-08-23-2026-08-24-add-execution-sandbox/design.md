## Context

内置 `bash` 工具需要 OS 级执行隔离。本 change 落地「执行沙箱」这一层：`SandboxBackend` 可插拔抽象 + docker / nsjail 双后端。与 guardrail（`beforeToolCall` 可执行拦截，已有）互补——guardrail 管「能不能做（策略）」，沙箱管「做了之后爆炸半径（隔离）」。

四层防御（见 AGENTS.md 5.6）：

| 层                | 机制                                  | 本 change 落地                               |
| ----------------- | ------------------------------------- | -------------------------------------------- |
| 0 配置层权限      | `security` 声明式 allowlist           | config Schema 新增                           |
| 1 Guardrail 拦截  | `beforeToolCall` 校验阻断             | 已有（AgentLoop），bash 策略在工具内兜底执行 |
| 2 Sandbox 隔离    | `SandboxBackend`                      | **本 change**                                |
| 3 资源限制 + 审计 | timeout / cpu / mem / pids / 输出截断 | **本 change** + hooks 已有                   |

## Goals / Non-Goals

**Goals:**

- 定义 `SandboxBackend` 接口，聚焦「执行原生命令」。
- 实现 docker + nsjail 双后端（复用系统二进制，不引三方沙箱 npm 库）。
- 后端选择 `auto` 探测 + 「不可用即禁用」安全默认。
- 资源限制 + 输出截断 + 网络隔离。
- config `security` 段（可插拔、默认安全）。

**Non-Goals:**

- 不实现 `process` 裸奔后端（违背「无沙箱即禁用」）。
- 不实现 WASM/WASI `FunctionSandbox`——那是「不可信用户代码」沙箱，职责不同，留 M3（见 AGENTS.md 5.6 边界）。
- read_file / write_file 不走 OS 沙箱——它们是 fs 工具，用路径约束（见 add-builtin-tools）。
- 不实现缓存 / 权限校验的 meta tags 增强（M3+）。

## Decisions

### D1: `SandboxBackend` 只暴露 `exec` 一个方法

**选择**：接口只含 `kind` + `exec(req)`，不含 readFile / writeFile。

**理由**：沙箱的唯一职责是「隔离执行原生命令」。文件读写是 fs 工具（路径约束即可），放进沙箱会让接口膨胀且与 workspaceRoot 挂载耦合。**聚焦最小接口。**

### D2: 双后端 docker + nsjail，不实现 process

**选择**：`docker` + `nsjail` 两个后端，`auto` 探测；无可用后端时返回「不可用」，上层禁用 bash。

**理由**：与已确认决策一致（docker 跨平台含 macOS；nsjail 补「无 Docker 的 Linux」）；「无沙箱即禁用」是安全默认，绝不裸奔。

### D3: 复用系统二进制，不引三方 npm 沙箱库

**选择**：`child_process.spawn` 驱动 `docker` / `nsjail`。

**理由**：无合适的跨平台 npm 库能「隔离执行原生 bash」；真正的沙箱在 OS/容器层。复用系统二进制符合「复用优先，拒绝重复造轮子」。

### D4: 命令参数构建抽成可测纯函数

**选择**：`buildDockerArgs(req, opts)` / `buildNsJailArgs(req, opts)` 为纯函数，`exec` 仅消费其产物 spawn。

**理由**：CI / macOS 无法真跑 nsjail（甚至 docker），单测锁定 argv 结构即可验证加固参数正确，无需真实执行。

### D5: 输出截断 + 超时

**选择**：stdout/stderr 超过 `maxOutputBytes` 截断并置 `truncated: true`；`timeoutMs` 外层 `AbortController` + `kill` 兜底（docker 另加 `--stop-timeout`）。

**理由**：防止单次工具调用拖垮循环 / 撑爆内存。

### D6: 网络默认关闭

**选择**：`network` 默认 `'none'`（docker `--network none`；nsjail 默认自带 netns 隔离），`'allowed'` 才开放（docker `--network bridge`；nsjail `--net`）。

**理由**：默认最小权限，需要网络（如 kubectl 连集群）显式开启。

### D7: `auto` 探测策略

**选择**：`resolveSandboxBackend`：显式 `docker`/`nsjail` 优先；`auto` 时 docker 可用→docker，否则 Linux 且 nsjail 可用→nsjail，否则「不可用」。

**理由**：跨平台（macOS 用 docker，Linux 无 docker 用 nsjail）+ 安全降级。

### D8: config `security` 段（默认安全）

**选择**：`AgentConfig.security`（可选）含 `sandbox`（backend 默认 auto / image 默认 `agent-engine/sandbox` / workspaceRoot）、`bash`（enabled 默认 false / allowCommands / denyPatterns / allowNetwork 默认 false / timeoutMs / maxOutputBytes）、`files`（roots / maxFileBytes）、`webSearch`（endpoint / allowDomains / denyDomains / timeoutMs / maxOutputBytes）。

**理由**：与「配置即 Agent」一致——安全姿态也收敛到配置，每个 Agent 的爆炸半径可声明。

## Risks / Trade-offs

- [nsjail 在 macOS 无法运行] → 单测只测 argv 构建；运行时集成测试在 Linux/CI 或跳过；`auto` 在 macOS 落到 docker。
- [docker 参数跨版本差异] → 锁定常用加固参数，测试锁定 argv 结构；异常在 `exec` 捕获并抛可读错误。
- [输出截断内存开销] → `maxOutputBytes` 兜底 + 流式截断（读到上限即停）。
- [auto 探测依赖 which] → 用 `spawn`/`which` 探测，失败即「不可用」，不阻塞启动。

## Migration Plan

无迁移。`security` 为可选字段，旧配置缺省即「bash 禁用 + 其余工具默认策略」，向后兼容。
