## MODIFIED Requirements

### Requirement: assembleAgentLoop 装配

系统 SHALL 提供 `assembleAgentLoop(options)`（async）：安装 `plugins`，把收集的 tools 注册进 ToolRegistry、skills / rules 合并、hooks 注册进 HookPipeline、prompt 片段注入 system prompt，最终构造 `AgentLoop`。当传入 `security` 时，SHALL 调用 `registerBuiltinTools` 按 `tools` 引用装配内置工具。

#### Scenario: 装配含 plugin 的 Agent

- **WHEN** 传入基础配置与一个注册了 tool 的 plugin
- **THEN** 返回的 `AgentLoop` 的 ToolRegistry 含该 tool，且 run 可用

#### Scenario: 传 security 装配内置工具

- **WHEN** 传入 `security`（含 `bash.enabled: false`）与 `tools` 引用
- **THEN** 返回的 `AgentLoop` 的 ToolRegistry 含配置声明的内置工具（如 `builtin.read_file`），不含 `bash`
