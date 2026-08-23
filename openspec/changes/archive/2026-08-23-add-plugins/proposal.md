## Why

八大可配置项中，plugins 是「扩展层」的收口：把「多个 tools + skills + hooks + rules + system-prompt 片段」打包成一个可整体安装/卸载的单元（AGENTS.md 5.2 / 8.3）。当前已具备 tools / skills / hooks / rules 各机制，但缺 plugin 这一「打包分发」层，无法一次安装一组领域能力。

## What Changes

- **`Plugin` 类型**：`name` + `description`（匹配面）+ `version` + `tags` + `install(ctx)`。
- **`PluginContext` 接口**：`registerTool` / `registerSkill` / `registerHook` / `registerRule` / `provideSystemPrompt`（`registerMemoryBackend` 留 M3）。
- **`PluginManager`**：`install` / `installAll`，把 plugin 注入的能力收集进 `PluginAssembly`。
- **`assembleAgentLoop`**（async 工厂）：安装 plugins → 合并能力（tools 注册 / skills·rules 合并 / hooks 注册 / prompt 片段预注入 system prompt）→ 构造 `AgentLoop`。这是「装配层」的雏形（6.1 循环图的「装配」环节）。

## Capabilities

### New Capabilities

- `plugins`: Plugin 类型、PluginContext、PluginManager、装配工厂。

## Impact

- 新增 `packages/core/src/plugins/`（types / manager / index）与 `packages/core/src/agent/assemble.ts`。
- 修改 `packages/core/src/index.ts`（导出）。
- 无新增依赖、无 breaking changes（纯增量）。
