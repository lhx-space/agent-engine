## Why

实测（DeepSeek anthropic 端点）暴露出三个真实 bug，导致「工具一调度就失败」：

1. **Anthropic 流式 tool_use 参数聚合 index 错位**：`chatCompletionStream` 用数组按 content_block `index` 回填，当 assistant 消息先有 text block（index 0）再有 tool_use（index 1）时，`toolCalls[1]` 为 undefined，参数丢空 → 工具收到 `{}` → 校验失败。
2. **Anthropic 多 tool_result 未合并**：每个 `role=tool` 消息被转成独立 user 消息，但 Anthropic 要求一个 assistant 的多个 `tool_use` 的 `tool_result` 必须出现在「紧接的下一个 user 消息」里（多个 block），否则 400 `tool_use ids were found without tool_result blocks`。
3. **`datetime` format 输出不完整**：`Intl.DateTimeFormat` 默认只出日期（无星期/时分秒），模型反复追问「星期几 / 几点」拿不到。

## What Changes

- `anthropic.ts`：流式 tool_use 改用 `Map<blockIndex, ToolCall>` 对齐聚合；`buildAnthropicMessages` 把连续 tool 消息合并进单个 user 消息（多 `tool_result` block）。
- `datetime.ts`：`format` 输出 `dateStyle: 'full' + timeStyle: 'long'`（星期 + 日期 + 时分秒）。

## Capabilities

### Modified Capabilities

- `llm-provider`: Anthropic tool_result 合并 + 流式 tool_use index 对齐。
- `builtin-tools`: datetime `format` 完整输出。

## Impact

- 修改 `packages/core/src/llm/anthropic.ts`、`packages/core/src/tools/builtin/datetime.ts`。
- 扩展 `packages/core/tests/llm.test.ts`、`packages/core/tests/builtin-tools.test.ts`。
- 无 breaking changes。
