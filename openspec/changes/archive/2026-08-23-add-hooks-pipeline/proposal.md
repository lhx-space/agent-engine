## Why

Agent Loop（M1 已实现）通过 `AgentHooks` 预留了 4 个调用点，但它只是一个「可选方法注入」的简单接口——没有配置驱动的 hooks 管线，无法支持「多个 hook 的注册、链式执行、数据改写、错误处理」。而 hooks 是 M2「执行控制层」的根基：日志、审计、限流、埋点、内容过滤、可观测都需要挂到生命周期上，后续 rules（guardrail）、plugins 也会复用同一套钩子点。

因此需要先把「hooks 管线」这一机制落地：统一的 `Hook` 接口 + `HookPipeline`（注册与链式执行），并让 Agent Loop 接入它。

## What Changes

- 定义 `Hook` 接口：覆盖循环内钩子点（beforeLLM / afterLLM / beforeToolCall / afterToolCall / onStepEnd / onError），方法可**改写数据**（返回 `T | void`）。
- 实现 `HookPipeline`：管理多个 hook、按钩子点分组、按注册顺序**链式执行**（前一 hook 的返回值传给后一 hook）。
- Agent Loop 集成：用 `HookPipeline` 替换现有 `AgentHooks` 简单注入，在对应节点调用管线。
- 明确 hooks **不做阻断**——阻断是 rules（guardrail）的职责（后续 change），本 change 只做「观察 + 改写」。

## Capabilities

### New Capabilities

- `hooks-pipeline`: `Hook` 接口、`HookPipeline` 链式执行、Agent Loop 集成（可改写语义、不做阻断）。

### Modified Capabilities

<!-- 无：agent-loop 的 requirement 不变，仅内部接入 HookPipeline 替换 AgentHooks -->

## Impact

- 新增 `packages/core/src/hooks/`（Hook 接口 + HookPipeline）。
- 修改 `packages/core/src/agent/loop.ts`（AgentHooks 替换为 HookPipeline）。
- 依赖：无新增三方依赖。
- 新增 `packages/core/tests/` 下的单元测试。
- 无 breaking changes（AgentHooks 为 M1 内部接口，可安全替换）。
