## Context

`core` 包已有 `LLMProvider`（统一 chat 接口）与 `ToolRegistry`（工具注册与执行）。本 change 实现 `AgentLoop`，把它们串成 ReAct 循环。循环结构对应 AGENTS.md 6.1 节的单 Agent 执行循环，但 hooks/rules 属 M2，本 change 只预留调用点。

## Goals / Non-Goals

**Goals:**

- 实现单 Agent ReAct 循环：LLM 调用 → 工具派发 → 回填 → 再调用，直至产出最终回答。
- 终止条件：无工具调用自然结束 + `maxSteps` 上限兜底。
- 工具执行失败回填错误结果（而非终止）。
- 预留 hooks 调用点（首版默认空操作）。

**Non-Goals:**

- 不实现 hooks/rules 管线（M2）——本 change 只预留调用点。
- 不实现 system-prompt 模板组装（M2 的 context 模块）——systemPrompt 由调用方传入。
- 不实现会话 memory / 上下文窗口裁剪（M2/M3）。
- 不实现流式输出（M4）。
- 不实现工具并行执行——首版顺序执行。

## Decisions

### D1: 类 `AgentLoop` 而非纯函数

**选择**：`AgentLoop` 类，构造时注入 provider / registry / systemPrompt，`run(userInput)` 驱动循环。

**理由**：循环状态（messages、步数）内聚在实例内，后续扩展（hooks、memory）更自然。

### D2: 首版顺序执行工具

**选择**：模型一次返回多个 `tool_calls` 时，按顺序逐个执行并回填。

**理由**：顺序执行简单、可预测、便于调试；并行执行（`Promise.all`）涉及竞态与错误聚合，留后续 change。

**备选**：并行执行。缺点：复杂度高，首版收益有限。**否决（留后续）**。

### D3: hooks 调用点预留（默认空操作）

**选择**：`AgentLoop` 在 beforeLLM / afterLLM / beforeToolCall / afterToolCall 四个节点调用注入的 hooks；未注入时跳过。

**理由**：M2 实现 hooks 管线时无需改动循环结构，只需传入真实 hooks。

### D4: maxSteps 默认 10，可覆盖

**选择**：`maxSteps` 默认 10，构造时可覆盖。

**理由**：防死循环兜底；10 步对首版足够。

### D5: 工具失败回填错误结果

**选择**：工具执行抛错时，将错误信息作为 tool 消息回填（content 为错误描述），循环继续，由模型决定下一步；`maxSteps` 兜底。

**理由**：对齐社区做法——让模型看到工具失败可自行调整重试，比内核直接终止更鲁棒。

**备选**：抛错终止循环。缺点：一个工具失败即整体失败，脆弱。**否决**。

## Risks / Trade-offs

- [工具失败回填导致模型无限重试] → `maxSteps` 兜底，达到上限即终止并返回当前状态。
- [上下文窗口随循环增长] → 首版不做裁剪，window 管理属 M2/M3 的 memory 模块。
- [模型返回既无 content 也无 tool_calls] → 视为终止，返回当前 message（content 可能为空）。

## Migration Plan

无迁移。core 包新增 `agent/` 模块并导出。

## Open Questions

- 无（hooks 管线、system-prompt 组装、memory、流式、并行均已明确留后续）。
