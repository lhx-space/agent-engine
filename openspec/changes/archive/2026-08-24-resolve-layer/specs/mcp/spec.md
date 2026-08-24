## MODIFIED Requirements

### Requirement: 装配接入

`connectMcpServers` SHALL 产出 `CapabilityBundle`（tools + `dispose` 关闭连接）；resolve 层 SHALL 把该 bundle 合并进 AgentLoop 的 registry，并将其 `dispose` 聚合进 `ResolvedAgent.dispose()`。`AgentLoop` 本身 SHALL 不持有 mcp 连接字段。

#### Scenario: 装配注册

- **WHEN** 传入 `mcp: [{ name, command, args }]` 经 resolve 装配
- **THEN** 返回的 AgentLoop 的注册表包含该 server 归一化出的工具

#### Scenario: dispose 聚合关闭

- **WHEN** 调用 `ResolvedAgent.dispose()`
- **THEN** 所有 MCP 连接被关闭
