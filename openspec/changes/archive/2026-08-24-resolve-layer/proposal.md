## Why

「配置即 Agent」还没闭合：`loadAgentConfig` 能产出 `AgentConfig`，但 `assembleAgentLoop` 只吃**代码**（provider / registry / rules / skills / plugins / mcp 都要调用方手动传），缺一座 `AgentConfig → AgentLoop` 的桥。同时，当前「每次新增能力都要同步 loop / plugins / assemble」的同步负担源于：各能力来源的产出形状不统一（`PluginAssembly` / MCP 的 `connections+tools+close` / builtin 直写 registry），且 MCP 的生命周期（`dispose`）泄漏进了 `loop.ts`（`mcpConnections` 字段）。

本 change 落地 resolve 层：把各来源统一成 `CapabilityBundle`，一个 `mergeBundles` 汇聚进 AgentLoop 的既有 sinks，`loop.ts` 回归纯原语，`resolveAgentConfig` 一键装配。

## What Changes

- 定义 `CapabilityBundle`（tools / skills / hooks / rules / promptFragments / dispose?），plugin / mcp / builtin / config 各来源统一产出 bundle。
- `loop.ts` 移除 `mcpConnections` / `dispose`，回归纯原语；dispose 聚合到 `ResolvedAgent.dispose()`。
- 新增 `core/src/resolve/`：`resolveAgentConfig(config, deps?) → ResolvedAgent`，读全量 `AgentConfig` 装配 provider / tools / skills / plugins / mcp / rules / systemPrompt / memory / security。
- plugin 按名实例化：`deps.pluginFactories`（name → factory）解析 `config.plugins` 字符串名；缺失报可读错误。

## Capabilities

### New Capabilities

- `agent-resolve`: `CapabilityBundle` 统一、`mergeBundles`、`resolveAgentConfig`、plugin 工厂注册表、`ResolvedAgent.dispose`。

### Modified Capabilities

- `plugins`: `PluginAssembly` 泛化为 `CapabilityBundle`（含 dispose），`assembleAgentLoop` 基于 bundles 装配。
- `mcp`: 「装配接入」改为 dispose 走 bundle，loop 不再持有 mcp 字段。

## Impact

- 新增 `packages/core/src/resolve/`（`types.ts` / `bundle.ts` / `resolve.ts` / `index.ts`）。
- 修改 `packages/core/src/agent/loop.ts`（移除 mcpConnections/dispose）、`agent/types.ts`、`agent/assemble.ts`（基于 bundle）。
- 修改 `packages/core/src/plugins/*`（PluginAssembly → CapabilityBundle）、`mcp/*`（产出 bundle + dispose）。
- 扩展 `packages/core/src/index.ts` 导出。
- 无新增三方依赖；无新增配置字段。
- **行为变更（重构）**：`AgentLoop` 不再有 `dispose()`（改到 `ResolvedAgent.dispose()`）；`assembleAgentLoop` 内部改用 bundle 合并。
- **目录结构修正**：resolve 层在 `core`（依赖 provider/registry/mcp/plugins），`config/src/resolve/` 只做配置级归一化（env 插值 / $ref / extends，后续 change）。
