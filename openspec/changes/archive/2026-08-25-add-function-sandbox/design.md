## Context

执行沙箱目前只覆盖原生命令（`bash` 经 docker/nsjail）。不可信**用户代码/工具函数**的隔离是正交需求：WASI 沙箱的是「编译成 wasm 的代码」，不能沙箱 bash/kubectl。本 change 立 `FunctionSandbox`（wasm/WASI），零 Docker 依赖。

## Goals / Non-Goals

**Goals:**

- `FunctionSandbox` 接口 + `WasiFunctionSandbox` 默认（复用 Node 内置 `node:wasi`）。
- 隔离 + 超时 + 输出截断 + args/stdin/env 透传。

**Non-Goals:**

- 不做 bash/kubectl 的 WASI 化——原生命令仍走 `SandboxBackend`（docker/nsjail）。
- 不引 wasmtime/wasmer 原生运行时——`node:wasi` 已够（零额外依赖）；后续需要更强隔离/更多 WASI 特性时可换后端（接口已留注入点）。
- 不做函数注册 DSL / 配置轴——首版只提供可编程接口。

## Decisions

### D1: 用 `node:wasi`，不引 wasmtime/wasmer

**选择**：`WasiFunctionSandbox` 复用 Node 内置 `node:wasi`（WASI preview1），不引原生 wasmtime/wasmer。

**理由**：零额外依赖、跨平台、Node ≥20 内置；WASI preview1 满足「隔离执行不可信 wasm」的最小语义。wasmtime/wasmer 是更强的隔离/更多特性，属后续可选后端（`FunctionSandbox` 接口已留注入点）。

### D2: 子进程运行 + 超时杀 + stdio 捕获

**选择**：把 wasm 写到临时文件，spawn 子 `node` 进程跑 runner（`--no-warnings --input-type=module -e`），父进程捕获 stdout/stderr、超时 SIGKILL、输出截断。

**理由**：`wasi.start()` 是同步调用（阻塞事件循环），超时必须靠进程级 kill；stdout 捕获（WASI fd 1 → 子进程 stdout 管道）也只能在独立进程里干净地做。镜像 `SandboxBackend` 的 child_process 架构。

### D3: 测试复用 `wabt` 编译 WAT

**选择**：core 的 devDependency 引入 `wabt`（WebAssembly Binary Toolkit），测试里把 WAT 文本编译成 wasm 喂给沙箱。

**理由**：真实端到端验证 WASI 执行（非 mock）；`wabt` 是官方二进制工具、仅测试用，符合「复用优先」。

## Risks / Trade-offs

- [`node:wasi` 标记 experimental] → 仅影响 runner 内部，接口稳定；子进程加 `--no-warnings` 抑制告警。Node 版本升级时需回归。
- [每次 exec 写临时文件 + 起子进程，开销较高] → FunctionSandbox 面向「不可信用户代码」低频场景，非热路径；后续可加缓存/复用。
- [WASI preview1 能力有限（无网络/线程）] → 符合「隔离不可信代码」的安全默认；更强能力走可插拔后端。

## Migration Plan

- 纯新增模块，无破坏。
- 后续（可选）：配置轴（`security.functionSandbox`）、wasmtime/wasmer 后端、函数注册 DSL。
