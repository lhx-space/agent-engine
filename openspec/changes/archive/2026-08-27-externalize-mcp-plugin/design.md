## Context

MCP 是「外部工具来源」的典型：连接 server → 归一化工具 → 注入 registry → 关闭连接。core 只需认识「工具来源」协议（`ToolSource`），不必认识 MCP 细节。这是 D4 的落地。

## Goals / Non-Goals

**Goals:**

- core 新增 `ToolSource` 协议 + `registerToolSource` + `assemble` resolve。
- MCP 实现外放 `@agent-engine/plugin-mcp`。
- 删除 `mcp.connected` / `mcp.failed` 事件（外放后 core 不再感知 MCP 装配）。

**Non-Goals:**

- 不改 MCP 连接 / 归一化 / 结果 / 错误隔离语义。
- 不改 `config.mcp` schema。

## Decisions

### D1: `ToolSource` 协议承载外部工具来源

**选择**：`ToolSource { name; resolve() → Promise<{ tools: Tool[]; dispose() }> }`；`assemble` 遍历 `merged.toolSources`，逐个 `resolve`（失败隔离 console.warn），注册工具并聚合 `dispose`。

**理由**：MCP 只是 `ToolSource` 的一个实现；未来其它外部工具来源（如 CLI 工具发现）走同一协议。`resolve` 由实现内部做错误隔离（MCP 的 `Promise.allSettled`），core 只处理「单个来源整体失败」。

### D2: MCP 错误隔离与事件随实现外放

**选择**：`connectMcpServers` 保持 `allSettled` 错误隔离，返回 `{ tools, errors, dispose }`；`createMcpPlugin` 内 `console.warn` 报告失败项。删除 `mcp.connected` / `mcp.failed` 事件。

**理由**：`plugin-mcp` 的 `install`/`resolve` 没有 `EventBus` 出口；MCP 连接结果的可观测改为 `console.warn` + `errors` 返回值。事件类型随之精简。

### D3: `ResolvedMcpServer` 随 MCP 外放

**选择**：`resolveMcpServer` / `resolveMcpServers` / `ResolvedMcpServer` 迁入 `plugin-mcp`；core 的 `capability-source/types.ts` 只留 `ToolSource`。

**理由**：`ResolvedMcpServer`（command 形态）是 MCP 的解析细节，不是通用协议。

## Risks / Trade-offs

- [MCP 工具默认失效] 外放后 `assemble` 不再主动连接 MCP，需组合层装配 `plugin-mcp`（Phase 4）才生效。过渡态符合 plan。
- [事件可观测性回退] `mcp.connected` / `mcp.failed` 事件消失，改为 `console.warn`。作为过渡接受。
