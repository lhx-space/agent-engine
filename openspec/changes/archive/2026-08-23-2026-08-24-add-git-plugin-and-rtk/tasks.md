## 1. rtk 接入

- [x] 1.1 config `sandbox.compact`（默认 false）
- [x] 1.2 `SandboxExecRequest.compact` + `SandboxBackendOptions.compact`
- [x] 1.3 docker/nsjail 后端 compact 时 `rtk <cmd>` 包装
- [x] 1.4 resolveSandboxBackend 透传 compact

## 2. git plugin

- [x] 2.1 建 `packages/plugins/git/`（package.json / tsconfig / tsdown.config / README）
- [x] 2.2 `createGitPlugin({ sandbox, policy })` + `git` 工具（只读策略 + compact）
- [x] 2.3 导出 + workspace 纳入

## 3. 测试与文档

- [x] 3.1 rtk 包装（docker/nsjail argv）测试
- [x] 3.2 git plugin（只读放行 / 破坏性阻断 / compact）测试
- [x] 3.3 AGENTS.md 记录 rtk + git plugin
