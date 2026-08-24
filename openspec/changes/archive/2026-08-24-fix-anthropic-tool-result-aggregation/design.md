## Context

DeepSeek 的 Anthropic 兼容端点（`provider: anthropic` + `baseURL: https://api.deepseek.com/anthropic`）实测暴露三个 bug：流式 tool_use 参数丢空、多 tool_result 违反 Anthropic 消息协议、datetime format 输出不完整。前两个在 `harden-loop-session-lifecycle` 的「并行 tool_calls」下被放大，但根因在 anthropic provider 的协议适配。

## Goals / Non-Goals

**Goals:**

- 流式下 tool_use 的 input 分片按 content_block `index` 正确聚合（不再丢空）。
- 连续 tool 结果合并进单个 user 消息（多 `tool_result` block），满足 Anthropic 协议。
- `datetime format` 输出含星期与时分秒。

**Non-Goals:**

- 不改 OpenAI 兼容实现的流式聚合（它已用 Map + index，无此问题）。
- 不引入工具入参错误重试（那是模型行为，另议）。

## Decisions

### D1: 流式 tool_use 用 `Map<blockIndex, ToolCall>` 对齐

**选择**：`toolCalls` 从数组改为 `Map<number, ToolCall>`，`content_block_start` 用 `event.index` 作 key，`input_json_delta` 用同一 `index` 累积，回填时 `toolCalls.get(index)`，输出按 index 排序。

**理由**：Anthropic 流式的 content_block `index` 是**整个消息内所有 block**（含 text block）的索引，不是 tool_use 的序号。数组下标错位是丢空参数的根因。Map + index 与 OpenAI 实现的 `StreamToolCallAccumulator`（Map + index）一致。

### D2: 连续 tool 消息合并进单个 user 消息

**选择**：新增 `buildAnthropicMessages`，遍历消息时把连续的 `role=tool` 消息聚合成一个 `{ role: 'user', content: [tool_result...] }`；遇到非 tool 消息先 flush 再单独转换。

**理由**：Anthropic 要求「一个 assistant 的 N 个 tool_use 之后，紧接的下一个 user 消息必须含 N 个 tool_result」。逐条转独立 user 消息会违反该约束导致 400。

### D3: datetime format 用 `dateStyle: 'full' + timeStyle: 'long'`

**选择**：`format` 分支加 `dateStyle: 'full'` 与 `timeStyle: 'long'`。

**理由**：默认 `Intl.DateTimeFormat` 只输出日期，模型拿不到星期/时分，反复调用。完整输出一次满足。

## Risks / Trade-offs

- [dateStyle/timeStyle 兼容性] → Node 20+ 与主流浏览器均支持，环境已满足；ICU 不同版本输出措辞略有差异，但必含星期与时分。
- [合并逻辑边界] → 仅合并**连续** tool 消息；非连续（中间夹 user/assistant）不合并，符合 Anthropic 语义（一个 assistant 多 tool_use 的 tool_result 本就应连续回填）。

## Migration Plan

无破坏。改动均在 anthropic provider 内部适配与 datetime 输出，接口签名不变。
