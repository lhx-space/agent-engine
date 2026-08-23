## Context

Agent Loop（`packages/core/src/agent/loop.ts`）当前通过 `AgentHooks` 接口（`beforeLLM` / `afterLLM` / `beforeToolCall` / `afterToolCall` 四个可选方法）注入钩子。这是 M1 的最小实现，只有「单对象注入」，没有「多 hook 管理、链式执行、数据改写、错误处理」。

本 change 引入正式的 hooks 管线，为 M2 的 rules / plugins / 可观测提供统一的挂载点。AGENTS.md 6.4 节定义了 9 个钩子点，其中**循环内**的有 beforeLLM / afterLLM / beforeToolCall / afterToolCall / onStepEnd / onError，会话级（onInit / onSessionStart / onSessionEnd）属更外层的 session 生命周期。

## Goals / Non-Goals

**Goals:**

- 定义 `Hook` 接口，方法可改写数据（返回 `T | void`）。
- 实现 `HookPipeline`：多 hook 注册、按钩子点分组、按序链式执行。
- Agent Loop 接入 HookPipeline，覆盖循环内钩子点。

**Non-Goals:**

- hooks 不做**阻断/拦截**——那是 rules（guardrail）的职责，留后续 change。
- 不实现会话级钩子（onInit / onSessionStart / onSessionEnd）——留 session 层。
- 不实现配置驱动的 hooks 装配（从 AgentConfig.hooks 自动加载）——本 change 只做机制，装配留后续 change。

## Decisions

### D1: hook 可改写数据（返回 `T | void`），不做阻断

**选择**：钩子方法返回 `T | void`——返回新值表示改写，返回 `void` 表示保持原值；没有「阻断」语义。

**理由**：按 AGENTS.md 5.3 节分工，hooks 负责「观察 + 增强（改写）」，rules 负责「拦截/阻断」。职责分离，避免两套拦截机制。

**备选**：hook 可返回「阻断」信号。缺点：与 rules 职责重叠，语义混乱。**否决**。

### D2: 链式执行（顺序 + 返回值传递）

**选择**：多个 hook 按注册顺序执行，前一 hook 的返回值作为后一 hook 的入参（`current = (await hook.fn(current)) ?? current`）。

**理由**：改写语义要求后序 hook 看到前序 hook 的改写结果，天然是链式。

### D3: hook 抛错向上传播

**选择**：hook 执行抛错时，触发 `onError` 钩子点（若已注册），随后**向上抛出**，不吞掉。

**理由**：hook 错误通常是插件/配置 bug，应暴露而非静默；`onError` 仅用于「观察」错误，不承担「恢复」。

### D4: 首版覆盖循环内钩子

**选择**：本 change 实现 beforeLLM / afterLLM / beforeToolCall / afterToolCall / onStepEnd / onError 六个循环内钩子点；会话级三钩子留 session 层。

**理由**：会话生命周期（多次 run 的组合）属更外层，过早引入会模糊 Agent Loop 的职责边界。

## Risks / Trade-offs

- [改写语义可能被误用为拦截] → 接口返回类型不含「阻断」分支，文档明确阻断归 rules。
- [hook 抛错导致整轮失败] → 符合「暴露 bug」原则；后续可加「hook 级容错」选项，但非首版。
- [onStepEnd / onError 与循环粒度耦合] → 定义清晰：onStepEnd 在每轮循环结束触发，onError 在任意异常时触发。

## Migration Plan

将 `AgentLoopOptions.hooks` 从 `AgentHooks` 替换为 `HookPipeline`；`AgentHooks` 接口删除（M1 内部接口，无外部使用方）。

## Open Questions

- 无（会话级钩子、配置驱动装配、rules 阻断均已明确留后续）。
