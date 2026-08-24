# mcp Specification

## Purpose

TBD - created by archiving change mcp-client. Update Purpose after archive.

## Requirements

### Requirement: MCP 连接（stdio）

系统 SHALL 提供 `connectMcpServer(server)`，用 `@modelcontextprotocol/sdk` 的 `Client` + `StdioClientTransport` 连接一个 MCP server；`server` 复用 `McpServer` 配置类型（`name` / `command` / `args` / `env`）。

#### Scenario: 连接成功

- **WHEN** 传入合法的 `{ name, command, args, env }`
- **THEN** 返回 `McpConnection`（含 `name` / `tools` / `close`）

#### Scenario: 连接失败含 server 名

- **WHEN** command 无法启动或连接失败
- **THEN** 抛出的错误包含 server 名与原因

### Requirement: 工具归一化

系统 SHALL 将 MCP `listTools()` 返回的工具归一化为标准 `Tool`：`name` / `description` 透传；`inputSchema` 用 pass-through（运行时不做强校验，交由 MCP server 校验）；`jsonSchema` 透传原生 JSON Schema 供 LLM；`execute` 调 `callTool` 并归一化结果。

#### Scenario: 归一化为 Tool

- **WHEN** 一个 MCP server 暴露工具 `get_weather`（含 name / description / inputSchema）
- **THEN** 归一化后得到 `Tool`，其 `jsonSchema` 等于原生 inputSchema，`name` / `description` 透传

### Requirement: 结果归一化

系统 SHALL 将 `callTool` 返回的 `content` 数组（text 块）拼接为字符串；`isError` 为真时抛错。

#### Scenario: 文本结果拼接

- **WHEN** `callTool` 返回多个 text content 块
- **THEN** 归一化结果为拼接字符串

#### Scenario: isError 抛错

- **WHEN** `callTool` 返回 `isError: true`
- **THEN** 抛出包含工具名与错误内容的异常

### Requirement: 错误隔离

`connectMcpServers(servers)` SHALL 并发连接多个 server，单个 server 连接失败不阻断其他 server（返回成功连接，并报告失败项）。

#### Scenario: 部分失败不阻断

- **WHEN** 两个 server 中一个连接失败
- **THEN** 返回成功 server 的连接，失败 server 以错误报告形式暴露

### Requirement: 生命周期

`McpConnection.close()` SHALL 关闭底层 client 连接；多次调用幂等。

#### Scenario: 关闭连接

- **WHEN** 调用 `close()`
- **THEN** 底层连接被关闭，再次调用不抛错

### Requirement: 装配接入

`assembleAgentLoop` SHALL 接受 `mcp` servers，连接并注册归一化工具；`AgentLoop.dispose()` SHALL 关闭所有已连接 MCP 连接。

#### Scenario: 装配注册

- **WHEN** 传入 `mcp: [{ name, command, args }]`
- **THEN** 装配后的 AgentLoop 的注册表包含该 server 归一化出的工具

#### Scenario: dispose 关闭

- **WHEN** 调用 `AgentLoop.dispose()`
- **THEN** 所有 MCP 连接被关闭
