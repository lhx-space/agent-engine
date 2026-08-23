## Context

tools / skills / hooks / rules 各机制已落地。plugin 是「打包分发」层：`install(ctx)` 通过 `PluginContext` 一次性注入多类能力。plugin 安装是异步的（`install` 可 `async`），而 `AgentLoop` 构造函数是同步的，因此安装放在「装配工厂」而非 AgentLoop 内部。

## Goals / Non-Goals

**Goals:**

- `Plugin` / `PluginContext` 类型 + `PluginManager`（install → `PluginAssembly`）。
- `buildSystemPrompt` 增加 `{{plugins}}` 注入。
- `assembleAgentLoop` async 工厂：安装 plugins 并合并能力，构造 `AgentLoop`。

**Non-Goals:**

- `registerMemoryBackend`（MemoryBackend 抽象 M3，接口预留不实现）。
- plugin 按需检索加载（5.5 的 `type='plugin'` 差异加载，后续接入 CapabilityLoader）。
- plugin 卸载 / 热更新 / 依赖声明。

## Decisions

### D1: plugin 安装放在装配工厂，不进 AgentLoop 构造函数

**选择**：`assembleAgentLoop`（async）负责 install plugins + 合并能力；`AgentLoop` 保持纯执行循环，不改构造。

**理由**：`install` 可异步，而构造函数同步；且「装配」本就是 6.1 循环图中 AgentLoop 之前的独立环节。装配工厂是「装配层」的雏形。

### D2: PluginContext 首版五个注册方法

**选择**：`registerTool` / `registerSkill` / `registerHook` / `registerRule` / `provideSystemPrompt`；`registerMemoryBackend` 留 M3。

**理由**：对齐 AGENTS.md 8.3，MemoryBackend 抽象未落地，首版不实现。

### D3: plugin prompt 片段装配时预注入

**选择**：`provideSystemPrompt(fragment)` 收集片段，`assembleAgentLoop` 拼接后追加到 system prompt（string 追加文本 / 模板对象追加到 `template`；函数式跳过）。

**理由**：plugin 片段是「装配时静态确定」的（非 run 时检索），装配工厂预注入即可，不改 `buildSystemPrompt` 的 run 时组装。

### D4: PluginManager 收集到 PluginAssembly

**选择**：`PluginManager.install` 用 `PluginContext` 把能力推入 `PluginAssembly`（tools / skills / hooks / rules / promptFragments 数组），由装配工厂合并。

**理由**：Manager 只负责「收集」，合并目标（ToolRegistry / HookPipeline / AgentLoop options）由装配工厂决定，保持 Manager 无副作用、可测。

## Risks / Trade-offs

- [装配工厂是雏形] → 后续 config 装配层（resolve）可复用/取代此工厂；当前先把 plugins 闭环。
- [plugin 重复安装] → `install` 由调用方控制次数；幂等性后续按需加。
- [hooks 需外部 HookPipeline] → 装配工厂仅在 `options.hooks` 存在时注册 plugin hooks；无 hooks 时忽略（或后续自动创建）。

## Migration Plan

无迁移：纯增量。后续 plugin 检索接入 `CapabilityLoader('plugin', ...)` 时，复用本 change 的 `Plugin` meta（description / tags）。
