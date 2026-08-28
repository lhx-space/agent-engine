## Why

MCP client（`connectMcpServer` / `connectMcpServers` / `toTool` / `normalizeCallToolResult` / `resolveMcpServer`）仍是 core 一等公民，`assemble` 硬编码 `connectMcpServers` + `mcp.connected` / `mcp.failed` 事件。这违背「能力外放、core 只留协议」。

本 change 落实 D4：core 新增 `ToolSource` 薄接口（外部工具来源），MCP 实现外放为 `@lhx-agent-engine/plugin-mcp`，`assemble` 改为「resolve `ToolSource` 注入工具 + 聚合释放」。

## What Changes

- **core 新增 `ToolSource` 协议**：`ToolSource { name; resolve() → { tools, dispose } }`；`PluginContext.registerToolSource` + `CapabilityBundle.toolSources`；`assemble` resolve 各 `ToolSource`（单个失败隔离）并聚合 `dispose`。
- **新增 `@lhx-agent-engine/plugin-mcp`**：迁入 MCP client / normalize / `resolveMcpServer`；新增 `createMcpPlugin(servers)`（注册 MCP `ToolSource`）。
- **core 删 MCP**：删 `mcp/` 目录、`capability-source/mcp.ts`；`assemble` 去掉 `options.mcp` + `connectMcpServers`；`mcp.connected` / `mcp.failed` 事件删除。
- **config 零迁移（D1-A）**：`config.mcp.servers` 字段不变，解释权移交 `@lhx-agent-engine/plugin-mcp`。

## Capabilities

### New Capabilities

- `plugin-mcp`: `@lhx-agent-engine/plugin-mcp` 提供 `createMcpPlugin` + MCP client + normalize + `resolveMcpServer`。

### Modified Capabilities

- `mcp`: 移除全部能力需求（连接/归一化/结果/错误隔离/生命周期/装配），迁至 `plugin-mcp`；core 只留 `ToolSource` 协议。
- `plugins`: `PluginContext` 新增 `registerToolSource`；`CapabilityBundle` 新增 `toolSources`；`assemble` 改 resolve `ToolSource`。
- `events`: `AgentEngineEvent` 移除 `mcp.connected` / `mcp.failed`。

## Impact

- 新增 `packages/plugins/plugin-mcp/`（package.json / tsconfig / tsdown / src / tests / README）。
- 修改 `packages/core/src/{mcp/*（删）,capability-source/{mcp.ts（删）,types.ts,index.ts},agent/assemble.ts,capability/{types,bundle}.ts,plugins/{types,manager}.ts,events/types.ts,resolve/resolve.ts,index.ts,types.ts,tsdown.config.ts,package.json}`。
- 迁移 `packages/core/tests/{mcp,capability-source}.test.ts`。
- 兼容性：`config.mcp.servers` 字段不变。
