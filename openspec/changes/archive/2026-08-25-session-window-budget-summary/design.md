## Context

批 B 已立起 `TokenCounter` / `ContextCompactor` 接口（默认 `ApproximateTokenCounter` / `TokenBudgetCompactor`），但尚未消费：`ConversationMemory` 仍按条数裁剪。三层记忆①②（正确截取 + 压缩层）要在这里落地——token 预算整轮淘汰 + 被淘汰旧轮经 LLM 滚动摘要。

## Goals / Non-Goals

**Goals:**

- `ConversationMemory` 消费 `ContextCompactor`（token 预算整轮裁剪）。
- `Summarizer` 接口 + `LLMSummarizer` 默认 + 插件注入，实现滚动摘要。
- 循环经 `getWindow()` 取回裁剪/摘要后的窗口。

**Non-Goals:**

- 不做语义层（③ embedding + pgvector 召回）——另立 change。
- 不做 `Summarizer` 的模型路由/温度配置——复用会话 `provider` 即可。
- 不做条数裁剪与 token 预算的「双轨复杂交互」——有 token 预算时条数裁剪退位为廉价安全网。

## Decisions

### D1: 裁剪/摘要状态收进 `ConversationMemory`，循环只调 `getWindow()`

**选择**：`ConversationMemory` 持有原始历史 + 滚动摘要，暴露异步 `getWindow()`；`AgentLoop` 从 `getMessages()` 改为 `await getWindow()`。

**理由**：摘要状态与历史强耦合，放 memory 内闭环（谁持有历史谁负责摘要）；循环保持「只读窗口」的薄接口。`getMessages()` 保留为原始内省（测试/调试）。

### D2: 滚动摘要以「头部 user 消息 + `[历史摘要]` 标记」注入

**选择**：摘要文本作为 `{ role: 'user', content: '[历史摘要]\n...' }` 置于窗口头部。

**理由**：不污染 system prompt（system 每轮动态组装）；不破坏 assistant `tool_call` ↔ `tool` 配对（头部 user 在配对之前）；OpenAI/Anthropic 均接受头部 user 消息。

### D3: 摘要用会话 `LLMProvider`，无独立模型配置

**选择**：`LLMSummarizer(provider)` 复用循环的 provider；插件可 `registerSummarizer` 替换。

**理由**：摘要是一次轻量 LLM 调用，单独配模型是成本优化而非能力缺口；接口已留注入点，后续需要时再分模型。

### D4: 有 token 预算时，条数裁剪退位

**选择**：`ConversationMemory` 配置了 `ContextCompactor` 时，`append` 不做条数裁剪（保留原始历史），裁剪统一在 `getWindow()` 做。

**理由**：若 append 先按条数丢轮，被丢的轮无法进摘要（信息已失）；统一在 getWindow 裁剪才能「淘汰 → 摘要」联动。

## Risks / Trade-offs

- [摘要消耗额外 LLM 调用/费用] → `summary` 默认 false，显式开启才生效。
- [LLMSummarizer 摘要质量不稳] → 接口可替换；默认 prompt 引导「保留关键事实与结论」。
- [`getWindow()` 异步化] → 循环 `run` 多一次 `await`，可忽略；`getMessages()` 同步保留不破坏既有调用。

## Migration Plan

- 无破坏：`summary` 默认 false、`maxTokens` 可选，不配则行为不变。
- 语义层（③）在其上另立 change：`getWindow` 之后接语义召回注入。
