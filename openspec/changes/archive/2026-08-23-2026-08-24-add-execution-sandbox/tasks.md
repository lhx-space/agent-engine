## 1. SandboxBackend 接口

- [x] 1.1 定义 `SandboxBackend` / `SandboxExecRequest` / `SandboxExecResult` / `SandboxBackendOptions` 类型
- [x] 1.2 `SandboxExecRequest` 含 command/args/cwd/env/timeoutMs/maxOutputBytes/network/limits

## 2. Docker 后端

- [x] 2.1 实现 `buildDockerArgs`（--rm / --network none / --read-only / --cap-drop ALL / --security-opt no-new-privileges / --pids-limit / --memory / --cpus / --user / workspace 挂载 / image / command）
- [x] 2.2 实现 `createDockerSandbox`（spawn + 超时 + 截断 + 环境透传）
- [x] 2.3 network `allowed` 时切换 `--network bridge`

## 3. nsjail 后端

- [x] 3.1 实现 `buildNsJailArgs`（timeout / rlimit_as / rlimit_cpu / user / workspace 挂载 / 默认网络隔离）
- [x] 3.2 实现 `createNsJailSandbox`（spawn + 超时 + 截断）
- [x] 3.3 network `allowed` 时加 `--net`

## 4. 后端选择工厂

- [x] 4.1 实现 `resolveSandboxBackend`（显式优先 / auto 探测 docker→nsjail→不可用）
- [x] 4.2 不可用时返回「不可用」信号（供上层禁用 bash）

## 5. config security Schema

- [x] 5.1 新增 `SandboxConfigSchema` / `BashPolicySchema` / `FilePolicySchema` / `WebSearchPolicySchema` / `SecurityConfigSchema`
- [x] 5.2 `AgentConfigSchema` 新增 `security: SecurityConfigSchema.optional()`
- [x] 5.3 校验默认值（backend auto / bash.enabled false / allowNetwork false）

## 6. 导出与测试

- [x] 6.1 在 `packages/core/src/index.ts` 导出 sandbox 模块类型与工厂
- [x] 6.2 `sandbox.test.ts`：docker/nsjail argv 构建、network 切换、输出截断、工厂探测（mock which）
- [x] 6.3 config schema 测试：security 默认值与校验
