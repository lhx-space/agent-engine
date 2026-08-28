## Context

能力外放后，`plugin-otel` 是最后一个空壳。它本质是「观察者」——不引入新能力，只把现有 hooks 生命周期转成 OTel span，属横切可观测。

## Goals / Non-Goals

**Goals:**

- `createOtelPlugin(options?)` 注入 hook，10 个生命周期点各产生一个 span。
- 只依赖 `@opentelemetry/api`（惰性 `trace.getTracer`），不绑定 exporter。
- 异常时 `recordException` + `status=ERROR`；hook 自身不改写任何值（纯观察）。

**Non-Goals:**

- 不内置 exporter / SDK 初始化（用户经 `@opentelemetry/sdk-node` 或手动 provider 配置）。
- 不做 metrics / logs 信号（首版只做 traces）。
- 不把 otel 接进 server 默认装配（opt-in 经 `config.plugins`）。

## Decisions

### D1: hooks → span（观察者，零改写）

**选择**：`createOtelHook` 覆盖全部 10 个 hook 方法，每个用 `startActiveSpan` 包一层，`beforeLLM` / `afterLLM` / `beforeToolCall` / `afterToolCall` 返回 `void`（不改写入参）。

**理由**：可观测是纯观察，改写会引入副作用与「观察者改变行为」的坑。返回 void 复用 HookPipeline 的「void = 保持原值」语义。

### D2: 只依赖 `@opentelemetry/api`

**选择**：span 用 `trace.getTracer(name)` 惰性获取；无全局 provider 时是 NOOP tracer（安全 no-op）。

**理由**：插件不绑定具体 exporter，用户按需接 SDK；测试也无需真实 exporter。

### D3: span 命名与属性

**选择**：span 名 `agent.init` / `agent.llm` / `agent.tool` / `agent.step` / `agent.session.*` / `agent.context.compose` / `agent.error`；属性前缀 `agent.*`。

**理由**：语义化分组，便于后端按 `agent.tool.name` 等维度聚合。

## Risks / Trade-offs

- [观察开销] 每个 hook 点一个 span，高并发下开销随 hook 数线性；otel 采样在 SDK 层配置，插件不介入。
- [无 exporter 时 no-op] 未配 provider 时 span 为 non-recording，功能静默关闭——符合「opt-in 可观测」。

## Migration Plan

- 新增 API，零迁移；用户 `config.plugins` 加 `@lhx-agent-engine/plugin-otel` 并按需配 exporter。
