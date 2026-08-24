## Why

MCP 是八大配置轴里「连接外部世界」的关键能力，但至今未落地：`AgentConfig.mcp.servers` 已在 Schema 中声明，`@modelcontextprotocol/sdk@1.30` 依赖已就位，`core/src/mcp/` 却不存在。没有 MCP，Agent 只能调用内置工具 + 插件，无法接入外部 MCP server（github / filesystem / database 等）暴露的工具与资源。这是「配置即 Agent」断掉的一环，也是当前 ReAct loop「很多还没接入」里最关键的缺口。

## What Changes

- 新增 `core/src/mcp/`：`connectMcpServer` / `connectMcpServers`（stdio transport，复用官方 SDK）、MCP 工具归一化为标准 `Tool`、`callTool` 结果归一化、错误隔离、`close()` 生命周期。
- `Tool` 接口新增可选 `jsonSchema`（原生 JSON Schema 无损透传，供 LLM 使用）；`toToolDefinition` 优先用它。MCP 工具的运行时校验走 pass-through（`inputSchema` 为宽松 schema，真正的入参校验由 MCP server 自行完成），避免把 MCP 的 JSON Schema 转成 Zod 的脆弱转换。
- `assembleAgentLoop` 新增 `mcp` 选项：连接并注册归一化工具；`AgentLoop.dispose()` 关闭所有 MCP 连接。

## Capabilities

### New Capabilities

- `mcp`: stdio 连接、工具归一化、结果归一化、错误隔离、生命周期、装配接入。

### Modified Capabilities

- `tool-registry`: `Tool.jsonSchema?` 原生 JSON Schema 透传（`toToolDefinition` 优先使用）。

## Impact

- 新增 `packages/core/src/mcp/`（`types.ts` / `normalize.ts` / `client.ts` / `index.ts`）。
- 扩展 `packages/core/src/tools/types.ts`（`jsonSchema?`）+ `tools/registry.ts`（`toToolDefinition` 优先 `jsonSchema`）。
- 扩展 `packages/core/src/agent/assemble.ts`（mcp 装配）+ `agent/loop.ts`（`dispose()`）+ `agent/types.ts`（`mcpConnections?`）。
- 扩展 `packages/core/src/index.ts` 导出 mcp 类型与工厂。
- **无新增三方依赖**：`@modelcontextprotocol/sdk` 已在 `packages/core/package.json` 依赖中。
- 新增 `packages/core/tests/mcp.test.ts`（`InMemoryTransport` 端到端 + 归一化单测）。
- 无 breaking changes：`Tool.jsonSchema?` 为可选字段，`assembleAgentLoop.mcp` 为可选选项。
