## Why

AGENTS.md §2.1 ⚠️ 清单最后一项是「`events/` 事件总线（目录未建）」——AGENTS.md §6.4 早已声明：模块业务事件（plugin 已装 / mcp 已连 / 工具已注册 / 规则·技能已加载）应走 `events/` 事件总线（发布/订阅）而非扩充 hooks，加载了哪些能力也要可观测。目前这些事件靠散落的 `console.warn`，无统一订阅点。本 change 立起事件总线 + 在装配层真实发事件 + 暴露 `custom` 逃生舱（用户/插件可发自定义事件）。

## What Changes

- 新增 `core/src/events/`：`EventBus`（`on`/`emit`）+ `AgentEngineEvent` 事件联合（`plugin.installed` / `mcp.connected` / `mcp.failed` / `tool.registered` / `rule.loaded` / `skill.loaded` / `custom`）。
- `assembleAgentLoop` 建 bus 并发事件（装插件、连 mcp、注册工具、加载规则/技能），随 `ResolvedAgent.eventBus` 暴露。
- `@agent-engine/core` 新增 `./events` 子路径。

## Capabilities

### Modified Capabilities

- `events`: 新增能力，定义 `EventBus` 与 `AgentEngineEvent`。
- `agent-resolve`: `ResolvedAgent` 增 `eventBus`。

## Impact

- 新增 `packages/core/src/events/{types.ts,event-bus.ts,index.ts}`。
- 修改 `packages/core/src/agent/assemble.ts`、`resolve/types.ts`、`index.ts`、`types.ts`、`tsdown.config.ts`、`package.json`。
- 测试：`events.test.ts`（on/emit + 取消订阅 + 装配期事件 + custom 逃生舱）。
- **非破坏**：纯新增事件发布/订阅，不影响现有 run 行为。
