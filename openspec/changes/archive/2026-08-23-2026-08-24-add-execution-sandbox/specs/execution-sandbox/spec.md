## ADDED Requirements

### Requirement: SandboxBackend 接口

系统 SHALL 定义 `SandboxBackend` 接口，含 `kind`（`docker` / `nsjail`）与 `exec(req)`（异步执行命令）；`SandboxExecRequest` SHALL 含 `command`、`args`、`cwd`、`env`、`timeoutMs`、`maxOutputBytes`、`network`（none / allowed）、`limits`（cpu / memory / pids）；`SandboxExecResult` SHALL 含 `exitCode`、`stdout`、`stderr`、`truncated`。

#### Scenario: 接口形状

- **WHEN** 定义一个实现 `SandboxBackend` 的对象
- **THEN** 它提供 `kind` 与 `exec(req): Promise<SandboxExecResult>`

#### Scenario: 请求携带资源与网络约束

- **WHEN** 构造一个 `SandboxExecRequest`
- **THEN** 可声明 `timeoutMs`、`maxOutputBytes`、`network: 'none'`、`limits` 等约束

### Requirement: Docker 后端

系统 SHALL 提供 `createDockerSandbox(options)`，通过 `docker run` 执行命令，并默认加固：`--rm`、`--network none`、`--read-only`、`--cap-drop ALL`、`--security-opt no-new-privileges`、`--pids-limit`、`--memory`、`--cpus`、非 root `--user`、workspace 挂载、指定 image 与 command。

#### Scenario: 默认加固参数

- **WHEN** 构建 docker 执行参数（network 默认 none）
- **THEN** argv 含 `--rm`、`--network none`、`--read-only`、`--cap-drop ALL`、`--security-opt no-new-privileges`、`--user` 等加固项

#### Scenario: 网络放行

- **WHEN** `network: 'allowed'`
- **THEN** argv 以 `--network bridge` 替代 `--network none`

### Requirement: nsjail 后端

系统 SHALL 提供 `createNsJailSandbox(options)`（Linux），通过 `nsjail` 执行命令，默认网络隔离并带 `timeout`、`rlimit_as`、`rlimit_cpu`、非 root `user`、workspace 挂载等加固项。

#### Scenario: 默认加固参数

- **WHEN** 构建 nsjail 执行参数（network 默认 none）
- **THEN** argv 含 timeout、rlimit、user、workspace 挂载等加固项

#### Scenario: 网络放行

- **WHEN** `network: 'allowed'`
- **THEN** argv 含 `--net` 以开放网络

### Requirement: 后端选择工厂与不可用降级

系统 SHALL 提供后端选择能力（如 `resolveSandboxBackend`）：显式 `docker` / `nsjail` 优先；`auto` 时按 docker 可用 → Linux 且 nsjail 可用 → 不可用的顺序解析。

#### Scenario: 显式指定后端

- **WHEN** 指定 `docker`
- **THEN** 返回 docker 后端（不可用时抛可读错误）

#### Scenario: auto 降级到不可用

- **WHEN** `auto` 且 docker / nsjail 均不可用
- **THEN** 返回「不可用」信号，供上层禁用 bash（绝不裸奔）

### Requirement: 资源限制与输出截断

系统 SHALL 在执行时施加 `timeoutMs` 超时与 `maxOutputBytes` 输出上限；超限时 stdout/stderr 被截断且结果 `truncated: true`。

#### Scenario: 输出超限截断

- **WHEN** 命令输出超过 `maxOutputBytes`
- **THEN** 结果被截断，`truncated` 为 true

#### Scenario: 超时终止

- **WHEN** 命令执行超过 `timeoutMs`
- **THEN** 进程被终止并抛可读错误

### Requirement: 网络隔离默认关闭

系统 SHALL 默认 `network: 'none'`（不开放网络）；仅当请求显式 `network: 'allowed'` 时才开放网络。

#### Scenario: 默认无网络

- **WHEN** 请求未声明 `network`
- **THEN** 沙箱内命令无外网访问能力

### Requirement: 沙箱不可用即禁用（安全默认）

当无可用沙箱后端时，系统 SHALL NOT 允许 `bash` 类命令在宿主进程执行；上层 SHALL 禁用该工具或抛错。

#### Scenario: 无沙箱不执行

- **WHEN** 沙箱后端不可用
- **THEN** bash 工具不被注册或执行时报错，绝不回退到宿主进程裸奔
