## Why

单 Agent 执行链路里存在三处真实缺陷（对照 AGENTS.md 已声明的行为）：

1. **memory 窗口裁剪会拆散 tool_call 配对**：`ConversationMemory.trim()` 按条数从头部 `splice`，可能删掉 assistant 的 `tool_call` 却留下后续 `tool` 结果（或反之），导致下一轮 messages 非法（OpenAI/Anthropic 直接报错）。这是正确性 bug。
2. **rules/skills 检索文本在 string/function 形态静默失效**：`resolveSystemPrompt` 只在 `SystemPrompt` 模板对象形态走 `buildSystemPrompt`（有兜底追加）；`systemPrompt` 为字符串或函数时直接返回，`rulesText`/`skillsText` 被丢弃——用户配置的 rules 文本静默不生效。
3. **skills 捆绑工具跨 run 残留**：每次 `run` 检索命中的 skill 工具只 `register` 不清理，多轮对话后工具列表膨胀、权限面扩大（且可能覆盖内置/插件工具后不还原）。

## What Changes

- `ConversationMemory`：窗口裁剪改为「整轮边界」淘汰——裁剪点对齐到 `user` 消息起点，不拆散 assistant `tool_call` 与后续 `tool` 结果配对。
- `AgentLoop.resolveSystemPrompt`：string / function 形态也兜底追加 rules/skills 文本（与模板对象形态的兜底逻辑一致）。
- `ToolRegistry`：新增 `unregister(name)`；`AgentLoop.run` 记录本轮注册的 skill 工具，结束（含异常）时还原/移除，避免跨 run 残留。

## Capabilities

### Modified Capabilities

- `session-memory`: 窗口裁剪改为整轮边界淘汰。
- `agent-loop`: string/function systemPrompt 兜底注入 rules/skills；skill 工具 run 结束清理。
- `tool-registry`: 新增 `unregister`。

## Impact

- 修改 `packages/core/src/memory/conversation-memory.ts`、`packages/core/src/agent/loop.ts`、`packages/core/src/tools/registry.ts`。
- 更新 `packages/core/tests/memory.test.ts`（整轮边界断言）+ `agent-loop.test.ts`（rules 兜底 + skills 清理）+ `tools.test.ts`（unregister）。
- 无新增三方依赖；无新增配置字段。
- **行为变更（修复）**：`maxMessages` 裁剪从「保留最近 N 条」变为「按整轮边界保留」，可能略超/略低于 N 以对齐轮次边界；这是正确性修复，非回归。
