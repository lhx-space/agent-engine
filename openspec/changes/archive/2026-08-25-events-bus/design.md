## Context

hooks 是「有限生命周期锚点」（观察 + 改写，不做阻断），模块业务事件（「规则命中」「plugin 已装」「mcp 已连」「加载了哪些能力」）需要的是**发布/订阅总线**，而非扩充 hooks（AGENTS.md §6.4）。目前这些事件只有 `console.warn`，无统一订阅点、无 `custom` 逃生舱。本 change 立起事件总线并在装配层真实发事件。

## Goals / Non-Goals

**Goals:**

- `EventBus`（`on(listener): unsubscribe` + `emit(event)`）+ `AgentEngineEvent` 事件联合。
- `assembleAgentLoop` 装配期发事件（装插件 / 连 mcp / 注册工具 / 加载规则·技能），随 `ResolvedAgent.eventBus` 暴露。
- `custom` 逃生舱：用户/插件可发任意自定义事件。

**Non-Goals:**

- 不做事件持久化 / 重放 / 跨进程（M3+ 的 OTel 接入在 server 层订阅 bus 即可）。
- 不改 `AgentRunEvent`（流式 `onEvent` 的可扩展性属另一个 change：`custom` 流式变体 + 桥接）。
- 不做事件到 pino 的自动日志（server 层订阅 bus 后自行接 pino）。

## Decisions

### D1: `AgentEngineEvent` 用判别联合 + `custom` 逃生舱

**选择**：`AgentEngineEvent = plugin.installed | mcp.connected | mcp.failed | tool.registered | rule.loaded | skill.loaded | custom{ name, data? }`。`custom` 是类型安全的最小逃生舱（`data?: unknown`），用户/插件自义事件经 `emit({ type:'custom', name, data })` 发出。

**理由**：模块业务事件有限且已知，用判别联合保持类型安全；`custom` 提供扩展点，不牺牲类型安全到「全 any」。这与 `AgentRunEvent`（流式）分开——后者可扩展性另立 change。

### D2: bus 在 `assembleAgentLoop` 内建、随 `ResolvedAgent` 暴露

**选择**：`assembleAgentLoop` 建 `EventBus`（可经 `options.eventBus` 注入，测试用），装配期 `emit` 各事件；`ResolvedAgent.eventBus` 暴露，server/用户订阅或发 `custom`。

**理由**：装配层是「装插件 / 连 mcp / 注册工具 / 加载能力」的唯一汇聚点，事件在此发出最自然；暴露后 server 订阅接 pino、用户订阅自定义逻辑。

### D3: 事件总线独立于 hooks，不新增 hook

**选择**：不新增 `onEvent` 类 hook 点，事件全走 `EventBus`；hooks 继续只做「观察 + 改写」。

**理由**：兑现 AGENTS.md §6.4「模块特定事件走 events 总线，不新增 per-module hook」，避免 hook 点随模块膨胀。

## Risks / Trade-offs

- [同步 emit] → 监听器同步执行，慢监听会阻塞装配；当前事件量小可接受，后续 OTel 接入用异步批量。
- [`custom.data?: unknown`] → 逃生舱丢失强类型；这是「可扩展」与「类型安全」的权衡，接受（用户自行收窄）。
- [事件丢失] → 装配完成前注册的监听器收不到早期事件（如 plugin.installed）；暴露时机在 `ResolvedAgent`，早期事件由内置逻辑记录，可接受。

## Migration Plan

- 无配置字段变化，向后兼容。
- server 层后续：`resolved.eventBus.on((e) => logger.info(e))` 接 pino；OTel 同理订阅。
