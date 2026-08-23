## MODIFIED Requirements

### Requirement: SandboxBackend 接口

系统 SHALL 定义 `SandboxBackend` 接口，含 `kind`（`docker` / `nsjail`）与 `exec(req)`（异步执行命令）；`SandboxExecRequest` SHALL 含 `command`、`args`、`cwd`、`env`、`timeoutMs`、`maxOutputBytes`、`network`（none / allowed）、`limits`（cpu / memory / pids）、`compact`（输出压缩）；`SandboxExecResult` SHALL 含 `exitCode`、`stdout`、`stderr`、`truncated`。

#### Scenario: 接口形状

- **WHEN** 定义一个实现 `SandboxBackend` 的对象
- **THEN** 它提供 `kind` 与 `exec(req): Promise<SandboxExecResult>`

#### Scenario: 请求携带资源与网络约束

- **WHEN** 构造一个 `SandboxExecRequest`
- **THEN** 可声明 `timeoutMs`、`maxOutputBytes`、`network: 'none'`、`limits`、`compact` 等约束

## ADDED Requirements

### Requirement: 命令输出压缩（rtk）

系统 SHALL 支持在 `SandboxExecRequest` 声明 `compact`；当 compact 为 true 时，docker / nsjail 后端 SHALL 以 `rtk` 包装命令（`rtk <command> <args>`）以压缩输出；`security.sandbox.compact` 为全局默认。

#### Scenario: compact 包装

- **WHEN** `compact` 为 true 执行 `git status`
- **THEN** docker / nsjail argv 以 `rtk` 为命令、`git status` 为参数

#### Scenario: 默认不压缩

- **WHEN** `compact` 未声明（默认 false）
- **THEN** 命令原样执行（不包装 rtk）
