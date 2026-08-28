# mcp Specification

## Purpose

TBD - created by archiving change mcp-client. Update Purpose after archive.

## Requirements

### Requirement: ToolSource 协议 + mcp 能力外放

系统 SHALL 定义 `ToolSource` 接口（`name` + `resolve() → Promise<{ tools: Tool[]; dispose() }>`），作为「外部工具来源」的薄协议；`assemble` SHALL resolve 各 `ToolSource`（单个失败隔离）并聚合 `dispose`。MCP client / 归一化 / 来源解析 SHALL 已外放为 `@lhx-agent-engine/plugin-mcp`，经 `registerToolSource` 注入；core 不再持有 MCP 实现。

#### Scenario: resolve 注入工具 + 聚合 dispose

- **WHEN** 装配一个注册了 `ToolSource` 的 plugin 并调用 `dispose`
- **THEN** `ToolSource.resolve` 的工具被注入 registry，其 `dispose` 被聚合执行
