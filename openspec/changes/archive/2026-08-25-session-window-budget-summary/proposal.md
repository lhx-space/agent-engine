## Why

批 B 已立起 `TokenCounter` / `ContextCompactor` 接口，但会话窗口仍按「条数」裁剪（粒度失控、且不接摘要）。AGENTS.md §5.4 三层记忆①② 需要把这两个接口真正「消费」进循环：① token 预算 + 整轮边界淘汰；② 被淘汰的旧轮经 LLM 滚动摘要，不丢上下文。

## What Changes

- `config`：`memory.session` 增 `maxTokens`（token 预算）与 `summary`（boolean，默认 false，滚动摘要开关）。
- `core/memory/summarizer.ts`：新增 `Summarizer` 接口 + `LLMSummarizer` 默认（用 `LLMProvider` 摘要旧轮）。
- `ConversationMemory`：接 `ContextCompactor` + `budgetTokens` + `Summarizer`；新增 `getWindow()`（token 预算整轮裁剪 + 淘汰轮并入滚动摘要 + 摘要作为头部 user 消息回填）。
- `AgentLoop`：`run` 用 `await memory.getWindow()` 取代同步 `getMessages()`。
- `plugins`：`registerSummarizer` + `CapabilityBundle.summarizers`（可插拔摘要策略）。
- `assembleAgentLoop` / `resolve`：装配时构造带裁剪/摘要的 memory，把 `config.memory.session` 接进来。

## Capabilities

### New Capabilities

<!-- 无新增能力目录：属 session-memory / agent-loop 既有能力。 -->

### Modified Capabilities

- `agent-config-schema`: `memory.session` 增 `maxTokens` / `summary`。
- `session-memory`: `ConversationMemory` 接 token 预算 + 滚动摘要（`getWindow`）。
- `plugins`: `PluginContext.registerSummarizer` + `CapabilityBundle.summarizers`。
- `agent-loop`: `run` 消费 `getWindow()`（裁剪/摘要后的窗口）。

## Impact

- 新增 `packages/core/src/memory/summarizer.ts`。
- 修改 `packages/config/src/schema/index.ts`、`packages/core/src/memory/{conversation-memory,types,index}.ts`、`packages/core/src/plugins/{types,manager}.ts`、`packages/core/src/capability/{types,bundle}.ts`、`packages/core/src/agent/{loop,assemble}.ts`、`packages/core/src/resolve/resolve.ts`、`packages/core/src/{index,types}.ts`。
- 测试：token 预算整轮裁剪 / 滚动摘要（LLMSummarizer mock）/ 插件 summarizer 注入 / resolve 装配。
- **非破坏**：`summary` 默认 false、`maxTokens` 可选；不配则行为与现状一致（条数裁剪保留为廉价安全网）。
