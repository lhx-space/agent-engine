## Why

M1 的前三块（config Schema、LLM Provider、Tool 注册表）都已就位，但它们是「零件」，还没有被串成一条可运行的执行链路。本 change 实现**单 Agent 执行循环（ReAct Loop）**，把这些零件组合起来：模型返回工具调用 → 内核执行工具 → 结果回填 → 再次调用模型，直到产出最终回答。这是 M1 的收官，也是内核执行引擎的第一条可运行路径。

## What Changes

- 实现 `AgentLoop`：输入 systemPrompt + LLM Provider + ToolRegistry + 用户消息，驱动 ReAct 循环。
- 循环逻辑：调用模型 → 若有 `tool_calls` 则逐个执行工具并回填结果 → 继续循环；否则产出最终结果。
- 终止条件：无工具调用（自然结束）或达到 `maxSteps` 上限（兜底防死循环）。
- 工具执行失败时，将错误信息作为 tool 消息回填（让模型可调整重试），而非直接终止。
- **预留 hooks 调用点**（beforeLLM / afterLLM / beforeToolCall / afterToolCall），首版以可选参数注入、默认空操作，M2 再实现配置驱动的 hooks 管线。

## Capabilities

### New Capabilities

- `agent-loop`: 单 Agent ReAct 执行循环（LLM 调用、工具派发与回填、终止条件、hooks 调用点预留）。

### Modified Capabilities

<!-- 无：llm-provider 与 tool-registry 的 requirement 不变，本 change 仅消费其类型 -->

## Impact

- 新增 `packages/core/src/agent/`（AgentLoop 实现）。
- 消费 `LLMProvider`（llm）与 `ToolRegistry`（tools）的既有类型。
- 依赖：无新增三方依赖（仅复用 `openai`/`@anthropic-ai/sdk` 之上的归一化类型）。
- 新增 `packages/core/tests/` 下的单元测试（mock LLM Provider 与 ToolRegistry）。
- 无 breaking changes。
