## Why

1. **git 工具套件**：软件研发 Agent 的高频能力，但属于「垂直套件 + 有副作用」，不应进内核 builtin，应做成 plugin（复用 `Plugin` + `SandboxBackend` + guardrail）。
2. **rtk 输出压缩**：命令输出是输入 token 的重要来源，复用 [rtk（Rust Token Killer）](https://github.com/rtk-ai/rtk) 在沙箱层智能压缩，省 token，不自研。

## What Changes

- **rtk 接入**：`security.sandbox.compact`（默认 false）；`SandboxExecRequest.compact` 与 `SandboxBackendOptions.compact`；docker / nsjail 后端在 compact 时以 `rtk <cmd>` 包装命令。
- **git plugin**：新包 `@lhx-agent-engine/plugin-git`（`packages/plugins/git/`），`createGitPlugin({ sandbox, policy })` 工厂返回 `Plugin`，注册 `git` 工具（默认只读子命令，破坏性子命令阻断；经沙箱执行并 `compact`）。

## Capabilities

### New Capabilities

- `git-plugin`: `@lhx-agent-engine/plugin-git` 包、`createGitPlugin`、`git` 工具（只读策略 + 沙箱执行）。

### Modified Capabilities

- `execution-sandbox`: `SandboxExecRequest` 增 `compact`；docker / nsjail 后端 compact 时 `rtk` 包装。
- `agent-config-schema`: `security.sandbox` 增 `compact`（默认 false）。

## Impact

- 新增 `packages/plugins/git/`（package.json / tsconfig / tsdown.config / src / tests / README）。
- 修改 `packages/config/src/schema/index.ts`（`sandbox.compact`）、`packages/core/src/sandbox/{types,docker,nsjail,index}.ts`（compact 包装）。
- **无新增 npm 依赖**：rtk 是沙箱镜像内的系统二进制（docker/nsjail 后端驱动），git 是系统命令。
- 更新测试；AGENTS.md 记录 rtk 需装进 `agent-engine/sandbox` 镜像。
