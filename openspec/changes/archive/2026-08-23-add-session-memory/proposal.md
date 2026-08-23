## Why

`AgentLoop.run(userInput)` 目前是无状态的：每次调用都重建 `[system, user]` 消息序列，run 之间不保留任何历史。这导致 Agent 无法多轮对话——用户追问「上一步的结果是什么」时，模型看不到之前的对话，只能当全新问题处理。

这是 AGENTS.md 5.4「上下文层」的另一半缺口：system-prompt 组装（`buildSystemPrompt`）已落地，但「会话上下文」尚未实现。多轮对话是 Agent 的基本能力，会话记忆是执行引擎的核心地基，优先级高于 skills / plugins 等能力扩展。

## What Changes

- **新增 `ConversationMemory`**（`core/src/memory/`）：管理会话消息历史（user / assistant / tool），支持追加、读取、清空，以及 `maxMessages` 窗口裁剪（超限保留最近 N 条）。
- **AgentLoop 集成**：`AgentLoopOptions.memory` 可选注入；`run` 时把历史拼进 messages，正常结束时把本轮消息（system 之外）写回 memory，实现跨 run 的多轮累积。
- **导出**：core 导出 `ConversationMemory` 及类型。

## Capabilities

### New Capabilities

- `session-memory`: 会话上下文窗口——`ConversationMemory` 历史管理 + `maxMessages` 窗口裁剪。

### Modified Capabilities

- `agent-loop`: 支持注入 `ConversationMemory`，run 读取历史、结束回写，实现多轮会话。

## Impact

- 新增 `packages/core/src/memory/`（`conversation-memory.ts` + `index.ts`）。
- 修改 `packages/core/src/agent/loop.ts`（`memory` 选项 + 历史读取/回写）与 `packages/core/src/index.ts`（导出）。
- 新增 `packages/core/tests/memory.test.ts`；扩展 `packages/core/tests/agent-loop.test.ts`。
- 无 breaking changes：`memory` 为可选，不注入时行为与现状一致。
- 依赖：无新增（纯内存实现，不引第三方）。
