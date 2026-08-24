## 1. Tool 接口扩展（jsonSchema 透传）

- [x] 1.1 `tools/types.ts` 新增可选 `jsonSchema?: Record<string, unknown>`
- [x] 1.2 `tools/registry.ts` `toToolDefinition` 优先用 `jsonSchema`，否则 `toJSONSchema(inputSchema)`

## 2. MCP client 模块

- [x] 2.1 `mcp/types.ts`：`McpConnection`（name / tools / close）
- [x] 2.2 `mcp/normalize.ts`：MCP 工具 → `Tool`（name/description 透传 + `jsonSchema` 透传 + `inputSchema` pass-through + `execute` 调 `callTool`）；`callTool` 结果归一化为字符串（text 块拼接 + `isError` 抛错）
- [x] 2.3 `mcp/client.ts`：`connectMcpServer`（`Client` + `StdioClientTransport`，含 name/command/args/env）+ `connectMcpServers`（并发、错误隔离）
- [x] 2.4 `mcp/index.ts` 导出

## 3. 装配接入

- [x] 3.1 `assembleAgentLoop` 新增 `mcp?: McpServer[]`，连接 + 注册归一化工具
- [x] 3.2 `AgentLoop` 新增 `mcpConnections` + `dispose()`（幂等关闭所有连接）
- [x] 3.3 `agent/types.ts` 新增 `mcpConnections?` 选项

## 4. 导出与测试

- [x] 4.1 `core/src/index.ts` 导出 mcp 类型与工厂
- [x] 4.2 `mcp.test.ts`：`InMemoryTransport` 端到端（连接/列工具/调用/关闭）+ 归一化单测 + 错误隔离单测
- [x] 4.3 `tool-registry` 测试补 `jsonSchema` 透传用例
