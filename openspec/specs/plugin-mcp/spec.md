# plugin-mcp Specification

## Purpose

TBD - created by archiving change externalize-mcp-plugin. Update Purpose after archive.

## Requirements

### Requirement: createMcpPlugin 注册 ToolSource

系统 SHALL 提供 `@lhx-agent-engine/plugin-mcp` 包，导出 `createMcpPlugin(servers)`，返回 `Plugin`；其 `install(ctx)` SHALL 在 `servers` 非空时调用 `ctx.registerToolSource` 注册一个 `ToolSource`（`name` 为 `@lhx-agent-engine/plugin-mcp`），`resolve` 时连接全部 servers 并返回归一化工具 + 聚合关闭。

#### Scenario: 注册 ToolSource

- **WHEN** 以非空 servers 构造并安装
- **THEN** 注册一个 `ToolSource`，名称为 `@lhx-agent-engine/plugin-mcp`

#### Scenario: 空 servers 零注册

- **WHEN** servers 为空数组时安装
- **THEN** 不注册 `ToolSource`，不报错

### Requirement: MCP 连接（stdio）

系统 SHALL 提供 `connectMcpServer(server)`，用 `@modelcontextprotocol/sdk` 的 `Client` + `StdioClientTransport` 连接一个 MCP server，返回 `McpConnection`（`name` / `tools` / `close`）；连接失败 SHALL 抛出含 server 名的错误。

#### Scenario: 连接成功 / 失败含名

- **WHEN** 传入合法 server 或无法启动的 command
- **THEN** 成功返回 `McpConnection`；失败抛出的错误含 server 名

### Requirement: 工具与结果归一化

系统 SHALL 把 MCP 工具归一化为标准 `Tool`（`name` / `description` 透传，`jsonSchema` 透传原生 schema，`execute` 调 `callTool`），并把 `callTool` 结果的 text 块拼接为字符串；`isError` 时抛错。

#### Scenario: 归一化 + 结果拼接

- **WHEN** 一个 MCP 工具经 `toTool` 归一化后执行，`callTool` 返回 text 块
- **THEN** `execute` 返回拼接字符串；`isError` 时抛错

### Requirement: 错误隔离与生命周期

`connectMcpServers(servers)` SHALL 并发连接多个 server，单个失败不阻断其他（返回成功工具 + 失败报告）；聚合 `dispose` SHALL 关闭全部连接（幂等）。

#### Scenario: 部分失败不阻断 + dispose 关闭

- **WHEN** 多 server 中一个失败，或调用 `dispose`
- **THEN** 成功 server 的工具被返回；`dispose` 关闭全部连接且幂等
