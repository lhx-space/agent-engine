## Why

`SandboxBackend`（docker / nsjail）沙箱的是 `bash`/`kubectl` 等**原生命令**；不可信**用户代码 / 工具函数**（编译成 wasm）是正交需求（AGENTS.md 5.6「WASM/WASI 边界」）。本 change 立起 `FunctionSandbox`：隔离执行 WASI 模块，零 Docker 依赖。

## What Changes

- `core/sandbox/function.ts`：`FunctionSandbox` 接口（`exec(req)`）+ `FunctionSandboxExecRequest/Result`（wasm 字节 + args/stdin/env + timeout/output 上限）。
- `WasiFunctionSandbox` 默认：复用 Node 内置 `node:wasi`，在子进程内运行 wasm（隔离 + 超时可杀 + stdout/stderr 捕获 + 输出截断）。
- 从 `sandbox/` 子路径与 core 根导出。

## Capabilities

### New Capabilities

- `function-sandbox`: 隔离执行 WASI 模块的 `FunctionSandbox` 接口 + `WasiFunctionSandbox` 默认实现。

### Modified Capabilities

<!-- 无既有 spec 变更。 -->

## Impact

- 新增 `packages/core/src/sandbox/function.ts`、`packages/core/tests/function-sandbox.test.ts`。
- 修改 `packages/core/src/sandbox/index.ts`、`packages/core/src/{index,types}.ts`、`cspell.json`（`wabt`）。
- 测试 dev 依赖：`wabt`（WAT → wasm 编译，复用官方二进制工具，仅测试用）。
- **非破坏**：纯新增模块，不触碰既有 `SandboxBackend`。
