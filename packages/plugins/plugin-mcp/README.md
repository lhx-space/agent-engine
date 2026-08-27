# @agent-engine/plugin-mcp

MCP tool-source plugin: registers a `ToolSource` that connects all `mcp.servers` (stdio transport) at assembly time and injects their normalized tools into the kernel. Core keeps only the `ToolSource` protocol; this plugin owns the MCP client.

## Install

```bash
pnpm add @agent-engine/plugin-mcp
```

## Usage

```ts
import { createMcpPlugin } from '@agent-engine/plugin-mcp';

const mcpPlugin = createMcpPlugin(config.mcp?.servers ?? []);

// 装配时传入 plugins: [mcpPlugin]
```

## API

- `createMcpPlugin(servers)` — returns a `Plugin` that registers an MCP `ToolSource`.
- `connectMcpServer(server)` / `connectMcpServers(servers)` — connect MCP servers via stdio.
- `resolveMcpServer(ref)` / `resolveMcpServers(refs)` — normalize `command` / `registry` sources.
- `toTool(meta, client)` / `normalizeCallToolResult(name, result)` — MCP tool normalization.
