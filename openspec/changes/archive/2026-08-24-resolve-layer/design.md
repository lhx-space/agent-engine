## Context

把 `AgentConfig` 一键装配成可运行的 `AgentLoop`。此前各能力来源产出形状不统一，且 MCP 生命周期泄漏进 loop，导致「每次加能力都要同步 loop/plugins/assemble」。本 change 用统一的 `CapabilityBundle` 收敛横向能力，loop 回归纯原语。

## Goals / Non-Goals

**Goals:**

- `CapabilityBundle` 统一形状，plugin / mcp / builtin / config 各来源都产出 bundle。
- `mergeBundles` 把多个 bundle 汇聚进 AgentLoop 的 sinks；`dispose` 聚合。
- `resolveAgentConfig(config, deps?) → ResolvedAgent` 一键装配。
- plugin 按名实例化（`deps.pluginFactories`）。

**Non-Goals:**

- 不实现 `orchestration.mode` 多 Agent 编排（独立 `@agent-engine/orchestration` 包，后续）。
- 不实现长期记忆后端 / `EmbeddingProvider`（M3 后续）。
- 不实现 `${ENV}` 插值、`$ref`/`extends` 引用解析（`config/src/resolve/` 配置级归一化，后续 change）。
- 不实现 hooks 配置（`HookConfigSchema {plugin,on}`）的实例化——目前无 builtin hook 实现，留待 hooks 补齐 change。

## Decisions

### D1: resolve 层放 core，不放 config

**选择**：`core/src/resolve/`；`config/src/resolve/` 只做配置级归一化（env 插值 / $ref / extends）。

**理由**：`AgentConfig → AgentLoop` 依赖 core 的 provider / registry / mcp / plugins / skills 加载；而依赖方向是 `config ← core`，config 不能反向依赖 core。二者是不同层级的「resolve」，不能混。

### D2: 统一 CapabilityBundle

**选择**：`CapabilityBundle = { tools, skills, hooks, rules, promptFragments, dispose? }`。`PluginAssembly` 泛化为它（补 `dispose`）；MCP 产出 `{ tools, dispose: 关闭连接 }`；builtin 产出 `{ tools }`。

**理由**：消除「来源 → sinks」的形态差异；加新来源只写 connector，不改 loop/assemble。

### D3: loop 回归纯原语

**选择**：`AgentLoop` 移除 `mcpConnections` / `dispose`；`dispose` 聚合到 `ResolvedAgent.dispose()`。

**理由**：loop 只该关心「如何执行」，不持有横向能力的生命周期。

### D4: plugin 按名实例化走注入的工厂表

**选择**：`resolveAgentConfig(config, { pluginFactories })`；`pluginFactories: Record<string, () => Plugin | Promise<Plugin>>` 解析 `config.plugins` 的字符串名；缺失报可读错误。

**理由**：core 不能 import 各 plugin 包（会反向依赖）；由 cli/server（同时依赖 core 与 plugin 包）注入 `{ '@agent-engine/plugin-git': () => createGitPlugin() }`。

### D5: mergeBundles 纯函数 + 单一汇聚点

**选择**：`mergeBundles(bundles)` 返回 `{ registry, hooks, rules, skills, promptFragments, dispose }`；`resolveAgentConfig` 用它构造 AgentLoop。

**理由**：汇聚逻辑单一，便于测试与复用；`assembleAgentLoop` 复用同一 merge。

## Risks / Trade-offs

- [resolve 层依赖注入增多] → `deps` 显式声明缺省，CLI/server 逐项注入，缺省报错而非隐式。
- [skills 相对路径] → `config.skills[].path` 相对 cwd 解析；绝对路径原样；baseDir 归 config 级 resolve 后续。
- [CapabilityBundle 重命名波及 plugins/mcp] → 纯内部类型重构，无对外 breaking（`PluginAssembly` 保留为别名过渡或直接替换）。

## Migration Plan

- `AgentLoop.dispose()` → `ResolvedAgent.dispose()`：调用方（现无）从 loop 迁移到 resolve 返回物。
- `assembleAgentLoop` 保持可用（内部改用 bundle）；新增 `resolveAgentConfig` 作为配置态入口。
