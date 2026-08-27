# @agent-engine/plugin-mcp

MCP 工具来源插件：注册一个 `ToolSource`，装配时连接全部 `mcp.servers`（stdio transport）并把归一化工具注入内核。core 只保留 `ToolSource` 协议；本插件持有 MCP client。

## 安装

```bash
pnpm add @agent-engine/plugin-mcp
```

## 用法

```ts
import { createMcpPlugin } from '@agent-engine/plugin-mcp';

const mcpPlugin = createMcpPlugin(config.mcp?.servers ?? []);

// 装配时传入 plugins: [mcpPlugin]
```

## API

- `createMcpPlugin(servers)` — 返回注册 MCP `ToolSource` 的 `Plugin`。
- `connectMcpServer(server)` / `connectMcpServers(servers)` — 经 stdio 连接 MCP server。
- `resolveMcpServer(ref)` / `resolveMcpServers(refs)` — 归一化 `command` / `registry` 来源。
- `toTool(meta, client)` / `normalizeCallToolResult(name, result)` — MCP 工具归一化。
