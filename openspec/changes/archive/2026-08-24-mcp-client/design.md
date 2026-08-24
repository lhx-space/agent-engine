## Context

MCP 是八大轴里「连接外部世界」的缺口。复用 `@modelcontextprotocol/sdk`（已在依赖中），stdio transport 接入外部 server，工具归一化为标准 `Tool`，纳入同一注册表。

## Goals / Non-Goals

**Goals:**

- `connectMcpServer` / `connectMcpServers`（stdio），工具归一化为 `Tool`。
- 原生 JSON Schema 无损透传供 LLM；错误隔离；`close` 生命周期。
- `assembleAgentLoop` 装配 + `AgentLoop.dispose`。

**Non-Goals:**

- 不实现 sse / streamableHttp / websocket transport（stdio 首版）。
- 不支持 resources / prompts 归一化（首版只 tools）。
- 不做 JSON Schema → Zod 转换（脆弱，见 D2）。

## Decisions

### D1: stdio transport 复用官方 SDK

**选择**：`Client` + `StdioClientTransport(command / args / env)`。

**理由**：复用优先；config 的 `mcp.servers` 本身就是 stdio（command + args）形态。

### D2: jsonSchema 透传，运行时 pass-through

**选择**：`Tool` 新增可选 `jsonSchema`；MCP 工具的 `inputSchema` 用 `z.unknown()`（pass-through），`jsonSchema` 透传原生 JSON Schema；`toToolDefinition` 优先 `jsonSchema`。

**理由**：MCP server 自行校验入参；JSON Schema → Zod 转换脆弱且多余。透传无损、不丢信息。

### D3: 结果归一化 + isError 抛错

**选择**：`content` 数组的 text 块拼接为字符串；`isError` 时抛含工具名与内容的错误。

### D4: 错误隔离

**选择**：`Promise.allSettled` 并发连接；单个 server 失败返回 `errors`，不阻断其他。

### D5: env 合并 process.env

**选择**：`resolveEnv` 把配置 `env` 合并到 `process.env` 之上。

**理由**：否则仅传 `GITHUB_TOKEN` 会丢 `PATH`，`npx` 等命令无法启动。

### D6: dispose 生命周期

**选择**：`McpConnection.close` 幂等；`AgentLoop.dispose` 聚合关闭。

**注**：后续 resolve 层会把它外移为 `CapabilityBundle.dispose`（横向统一），loop 回归纯原语。

## Risks / Trade-offs

- [stdio transport 跨平台] → 跟随 SDK（node spawn）；测试用 `InMemoryTransport` 免进程。
- [MCP server stderr 噪音] → 首版走 SDK 默认；后续接 pino。
- [工具名冲突（mcp vs builtin）] → registry 后者覆盖；后续 resolve 层做命名空间 / 优先级。

## Migration Plan

无破坏。`mcp` 为可选配置，缺省不连接。
