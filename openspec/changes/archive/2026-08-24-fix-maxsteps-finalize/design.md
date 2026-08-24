## Context

reasoning 模型（`deepseek-reasoner`）在 ReAct 循环里会把 step 花在「思考、列计划（todo）、逐项调研、更新 todo」上，`maxSteps`（默认 10）耗尽时往往停在「刚调完一批工具、准备输出最终答案」的中间态。此时 `finalMessage` 同时带 `content`（过渡文本）与 `toolCalls`，被误当最终结果，答案被截断。

## Goals / Non-Goals

**Goals:**

- 预算兜底（maxSteps / 超时）退出时，若 `finalMessage` 仍带 `toolCalls`，强制一轮「不带工具」的总结，产出纯文本最终结论。

**Non-Goals:**

- 不改变「自然终止」（模型主动返回无 tool_calls）的路径。
- 不做 token 预算 / 三层记忆（那是长期记忆 change）。
- 不引入可配置开关（默认开启，行为更合理）。

## Decisions

### D1: 总结调用不带 tools，强制纯文本

**选择**：总结请求只传 `messages`（+ `signal`），不传 `tools`；模型无工具可调，只能纯文本回复。

**理由**：这是「强制收尾」的关键——不传 tools 时模型不会返回 tool_calls，一次调用即可得到最终结论。总结调用计入 `steps`（emit `step_start`），沿用现有流式 / hook 逻辑。

### D2: 仅当「预算兜底退出 + finalMessage 仍带 toolCalls」时触发

**选择**：在 while 循环正常退出后检查 `finalMessage.toolCalls`；有则总结，无则不动。

**理由**：自然终止（无 tool_calls）时 finalMessage 就是最终答案，无需总结；只有被预算截断、模型还想继续调工具时才需要收尾。

## Risks / Trade-offs

- [多一次 LLM 调用成本] → 仅在被截断的边界情况发生，且换来「有结论」，值得。
- [总结调用仍可能超时/被取消] → 总结前检查 `signal`；超时由 provider 层处理。

## Migration Plan

无破坏。行为增强：预算兜底且带 tool_calls 时多一次总结调用；`steps` 计数 +1（`done` 事件的 `steps` 会相应 +1）。
