# function-sandbox Specification

## Purpose

TBD - created by archiving change add-function-sandbox. Update Purpose after archive.

## Requirements

### Requirement: FunctionSandbox 接口

系统 SHALL 定义 `FunctionSandbox` 接口（`kind` + `exec(req)`），`FunctionSandboxExecRequest` 含 `wasm`（Uint8Array）、`args?`、`stdin?`、`env?`、`timeoutMs?`、`maxOutputBytes?`；`FunctionSandboxExecResult` 含 `exitCode`、`stdout`、`stderr`、`truncated`。

#### Scenario: 执行 WASI 模块

- **WHEN** 以 `FunctionSandbox.exec` 执行一个向 stdout 写入并 `proc_exit(0)` 的 wasm
- **THEN** 返回 `exitCode=0`、`stdout` 为模块输出、`stderr` 为空、`truncated=false`

### Requirement: WasiFunctionSandbox 默认实现

系统 SHALL 提供 `WasiFunctionSandbox`（`kind='wasi'`），复用 Node 内置 `node:wasi` 在**子进程**内运行 wasm：透传非零 exitCode、超时（`timeoutMs`）终止并抛错、输出超过 `maxOutputBytes` 截断并置 `truncated=true`。

#### Scenario: 透传非零 exitCode

- **WHEN** 模块 `proc_exit(42)`
- **THEN** 返回 `exitCode=42`

#### Scenario: 输出截断

- **WHEN** 模块输出超过 `maxOutputBytes`
- **THEN** `truncated=true` 且 `stdout` 长度不超过 `maxOutputBytes`

#### Scenario: 超时终止

- **WHEN** 模块死循环且 `timeoutMs` 到期
- **THEN** `exec` 抛错（含 timeout/terminated 语义）
