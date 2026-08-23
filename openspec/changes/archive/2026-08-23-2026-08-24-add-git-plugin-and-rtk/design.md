## Context

git 工具套件是研发 Agent 的高频能力，但属「垂直套件 + 有副作用」，按纪律做成 plugin 而非内核 builtin。rtk 是「复用优先」的教科书案例：命令输出压缩不自研，复用 rtk 二进制。

## Goals / Non-Goals

**Goals:**

- rtk 接入沙箱层（compact 开关），docker / nsjail 后端 `rtk` 包装。
- `@agent-engine/plugin-git` 包 + `createGitPlugin` 工厂 + `git` 工具。

**Non-Goals:**

- 不做完整 config→plugin 实例化 resolve（M3）。
- 不做 commit/push 的多步确认流程（首版只读，破坏性子命令默认阻断）。
- 不把 rtk 装进 npm 依赖（rtk 是沙箱镜像内系统二进制）。

## Decisions

### D1: compact 在 SandboxExecRequest + SandboxBackendOptions

**选择**：`SandboxExecRequest.compact?: boolean`（单次覆盖）+ `SandboxBackendOptions.compact?: boolean`（全局默认，来自 `security.sandbox.compact`）；`req.compact ?? options.compact ?? false`。

**理由**：全局默认 + 单次覆盖；rtk 是「输出压缩」正交于隔离与截断。

### D2: docker / nsjail 以 `rtk <cmd>` 包装

**选择**：compact 时 argv 的 command 变 `rtk`、原 command 成为首参数（`rtk git status`）。

**理由**：rtk 是命令包装器（代理模式），逐命令包装最直接；rtk 不认识的命令透传。

### D3: git plugin 用工厂 `createGitPlugin({ sandbox, policy })`

**选择**：`PluginContext` 无沙箱访问，故 git plugin 以工厂闭包持有 `SandboxBackend`，`install(ctx)` 注册绑定沙箱的 `git` 工具。

**理由**：插件自包含、可测试；config→plugin 实例化（传沙箱/策略）留 M3 resolve。

### D4: git 默认只读策略

**选择**：`GitPolicy = { allowCommands: string[]; denyCommands: string[] }`；默认 allow 只读（status / diff / log / show / branch / remote / rev-parse / ls-files），deny 破坏性（commit / push / checkout / reset / clean / merge / rebase / rm / mv）；命中 deny 阻断。

**理由**：git 与 bash 同款白/黑名单模式，复用认知；首版只读安全默认。

### D5: git 执行带 `compact: true`

**选择**：git 工具经沙箱执行时 `compact: true`（rtk 对 git 输出压缩收益最高）。

**理由**：git status/diff/log 是 rtk 的核心收益命令集。

## Risks / Trade-offs

- [rtk 未装进沙箱镜像时 compact 失效] → 文档明确：`agent-engine/sandbox` 镜像须含 rtk；未装时 rtk 报错（命令找不到），`compact` 默认 false 不受影响。
- [git 需仓库/网络/身份] → 首版只读（status/diff/log）无网络无身份需求；commit/push 后续再启用。

## Migration Plan

无迁移。`security.sandbox.compact` 默认 false，向后兼容；git plugin 为新增包。
