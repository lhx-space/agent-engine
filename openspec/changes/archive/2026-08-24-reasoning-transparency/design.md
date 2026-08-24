## Context

用户要「think 和回复连续」——模型边思考边调度，最终回复。DeepSeek R1（`deepseek-reasoner`）通过 OpenAI 兼容端点返回 `reasoning_content`（思考）与 `content`（回复），流式下分别是 `delta.reasoning_content` 与 `delta.content`（[官方文档](https://api-docs.deepseek.com/guides/thinking_mode_api_example_streaming/)）。当前 openai provider 只读 `content`，思考被丢弃。本次把思考作为一等字段透传并展示。

关键前提：`reasoning_content` 是 **OpenAI 兼容端点**（`api.deepseek.com`）的特性；用户当前用 anthropic 端点（`provider: anthropic`）不返回该字段。要真思考，模型需切到 `provider: openai-compatible` + `model: deepseek-reasoner`（或未来 Claude 的 extended thinking，走 anthropic thinking blocks，本次不做）。

## Goals / Non-Goals

**Goals:**

- `ChatMessage.reasoning` 承载思考内容（可选）。
- openai provider 透传 `reasoning_content`（非流式 + 流式分片）。
- `onDelta` 加 `kind` 区分思考/回复增量，`llm_delta` 事件透传 `kind`。
- 前端「思考」折叠灰显 + 「回复」分开。

**Non-Goals:**

- 不做模型「分角色」（思考模型 + 执行模型分离）——那是后续多模型路由。
- 不做 anthropic 的 thinking blocks 透传（Claude extended thinking，后续）。
- 不改 loop 的决策逻辑（仍 ReAct，只是多透传一个字段）。

## Decisions

### D1: 思考用 `ChatMessage.reasoning?: string` 承载，不并入 content

**选择**：`ChatMessage` 新增可选 `reasoning` 字段，与 `content` 并列。

**理由**：思考与回复语义不同（思考不参与最终答案拼接、不应回填为 user 可读正文）；分开存储便于前端分开展示，也便于后续 token 统计/隐藏思考。回填历史时思考无需持久化（下一轮不需要模型的思考原文）。

### D2: `onDelta` 加 `kind`（`reasoning` / `content`，缺省 content）

**选择**：`chatCompletionStream` 的 `onDelta(delta, kind?)`；openai 流式在 `delta.reasoning_content` 时回调 `(text, 'reasoning')`，`delta.content` 时 `(text, 'content')`。

**理由**：单一回调 + 可选 kind，向后兼容（老调用方忽略第二参数）；比拆两个回调更小改动。R1 流式顺序是「先 reasoning 后 content」，kind 天然区分两段。

### D3: `llm_delta` 事件加 `kind`，前端按 kind 分桶

**选择**：事件 `{ type: 'llm_delta', delta, kind? }`；前端累积 `reasoning` 到「思考」块（灰显、可折叠）、`content` 到「回复」正文。

**理由**：前端「思考/回复」分开展示是本次可观测性的落点；kind 缺省 content 保证老事件兼容。

### D4: 非流式同样透传 reasoning

**选择**：openai 非流式读 `message.reasoning_content` → `ChatMessage.reasoning`。

**理由**：非流式路径也要对齐，否则只有流式有思考、非流式丢思考。

## Risks / Trade-offs

- [reasoning 字段在历史回填中的处理] → loop 回填 tool 消息时不带 reasoning；下一轮 messages 里 assistant 消息的 reasoning 可保留或省略（首版保留在结果，历史回填省略 reasoning 避免污染上下文）。
- [DeepSeek R1 工具调用与 reasoning 的顺序] → R1 会先出 reasoning 再出 tool_calls；我们透传 reasoning 不影响 tool_calls 聚合。
- [anthropic 端点不支持 reasoning_content] → 文档说明：真思考需 openai-compatible + deepseek-reasoner；anthropic thinking 后续。

## Migration Plan

无破坏。`reasoning` 可选、`onDelta.kind` 缺省 content、`llm_delta.kind` 可选；老 provider（anthropic / 自定义）不产出 reasoning，前端按 content 处理。
