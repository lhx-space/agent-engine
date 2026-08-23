## ADDED Requirements

### Requirement: todo 工具

系统 SHALL 提供 `todo` 内置工具，基于内存 `TodoStore`，支持 `add` / `list` / `update` / `delete` 四种 action；每个 item 含 `id` / `task` / `status`（pending / in_progress / completed）。

#### Scenario: 添加并列出

- **WHEN** 调用 `action: add` 传入 `task`
- **THEN** 返回新增 item（含自动生成的 `id`、`status: pending`），随后 `action: list` 返回含该 item 的列表

#### Scenario: 状态流转

- **WHEN** 调用 `action: update` 修改 `status` 为 `completed`
- **THEN** 该 item 状态更新，`list` 反映新状态

#### Scenario: 删除

- **WHEN** 调用 `action: delete` 传入存在的 `id`
- **THEN** 该 item 被移除

### Requirement: read_file 工具

系统 SHALL 提供 `read_file` 内置工具，仅在允许的根目录内读取文件；路径经 `resolve` + `realpath` 校验，越界（根外 / `..` / symlink 逃逸）SHALL 拒绝。

#### Scenario: 根内读取

- **WHEN** 读取根目录内存在的文件
- **THEN** 返回文件内容

#### Scenario: 越界拒绝

- **WHEN** 路径经 `realpath` 解析后落在允许根目录之外（含 symlink 逃逸）
- **THEN** 抛错且不读取

### Requirement: write_file 工具

系统 SHALL 提供 `write_file` 内置工具，仅在允许根目录内写入，且受 `maxFileBytes` 大小上限约束。

#### Scenario: 根内写入

- **WHEN** 写入目标在允许根目录内且未超上限
- **THEN** 写入成功并返回结果

#### Scenario: 越界或超限拒绝

- **WHEN** 目标越界或内容超过 `maxFileBytes`
- **THEN** 抛错且不写入

### Requirement: bash 工具

系统 SHALL 提供 `bash` 内置工具，仅在 `security.bash.enabled` 为 true 时可用；执行前 SHALL 校验 `allowCommands`（白名单，空 = 不限制）与 `denyPatterns`（黑名单，命中即拒绝），通过后经 `SandboxBackend.exec` 执行；无沙箱 SHALL 拒绝执行。

#### Scenario: 默认禁用

- **WHEN** `security.bash.enabled` 为 false
- **THEN** bash 工具不被注册

#### Scenario: 黑名单命中拒绝

- **WHEN** 命令命中 `denyPatterns` 中的模式
- **THEN** 拒绝执行且不调用沙箱

#### Scenario: 白名单放行

- **WHEN** `allowCommands` 非空且命令命中白名单、未命中黑名单
- **THEN** 经沙箱执行并返回 `SandboxExecResult`

#### Scenario: 无沙箱拒绝

- **WHEN** 沙箱后端不可用
- **THEN** 抛可读错误，绝不回退宿主进程执行

### Requirement: web_search 工具

系统 SHALL 提供 `web_search` 内置工具，经可注入的 `fetch` 请求配置的 endpoint，执行前对 endpoint host 做 domain 白/黑名单校验，并施加超时与输出截断。

#### Scenario: 允许域放行

- **WHEN** endpoint host 命中允许域（或未配置拒绝域）
- **THEN** 发起请求并返回截断后的结果

#### Scenario: 拒绝域拦截

- **WHEN** endpoint host 命中 `denyDomains`
- **THEN** 拒绝请求且不发起 fetch

### Requirement: 内置工具统一装配

系统 SHALL 提供 `registerBuiltinTools(registry, security, deps)`，恒注册 `todo` / `read_file` / `write_file` / `web_search`，并仅在 `security.bash.enabled` 时注册 `bash`。

#### Scenario: 默认装配

- **WHEN** 以缺省 `security` 调用 `registerBuiltinTools`
- **THEN** registry 含 `todo` / `read_file` / `write_file` / `web_search`，不含 `bash`

#### Scenario: 开启 bash 装配

- **WHEN** `security.bash.enabled` 为 true 且提供可用沙箱
- **THEN** registry 含 `bash`
