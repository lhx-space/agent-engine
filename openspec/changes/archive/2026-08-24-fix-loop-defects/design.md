## Context

单 Agent 执行链路三处真实缺陷：memory 按条数裁剪会拆散 tool_call 配对；rules/skills 在 string/function systemPrompt 形态静默失效；skills 捆绑工具跨 run 残留。

## Goals / Non-Goals

**Goals:**

- 整轮边界淘汰，不拆散 assistant `tool_call` ↔ 后续 `tool` 结果。
- string / function 形态兜底追加 rules/skills 文本。
- run 结束清理本轮注册的 skill 工具（快照还原）。

**Non-Goals:**

- 不做 token 预算裁剪（需 tokenizer，留 M3 三层记忆）。
- 不做滚动摘要 / 语义记忆。
- 不做重复工具调用检测（增强，非 bug）。

## Decisions

### D1: 整轮边界裁剪

**选择**：裁剪点对齐到 `user`（轮次起点）；预算内无起点时退到最近的 `user`，保留最近一个完整轮次（宁略超预算）。

**理由**：不拆散配对 > 严格满足条数；非法序列（孤立 tool 消息）会直接让 OpenAI/Anthropic 报 400。

### D2: rules/skills 兜底追加（string / function）

**选择**：`appendContext` 把 `rulesText` / `skillsText` 追加到基础 prompt；模板对象仍走 `buildSystemPrompt`（其内部已有兜底）。

**理由**：让 rules 在三种 systemPrompt 形态下都生效，消除「配置了 rules 却不注入」的静默失效。

### D3: skill 工具快照还原

**选择**：注册前 `get` 快照同名工具；`run` 的 `finally` 里「有 prior 还原 / 无 prior `unregister`」。

**理由**：skill 工具可能覆盖同名内置/插件工具，直接删会误删；快照还原可精确恢复。

## Risks / Trade-offs

- [裁剪可能略超 maxMessages] → 正确性优先，保留完整轮次。
- [函数式 systemPrompt 追加 rules 改变输出] → 与模板对象兜底语义一致，属预期修复。
- [skill 工具清理增加 run 开销] → 仅命中 skill 时 O(k)，可忽略。

## Migration Plan

行为变更：`maxMessages` 从「严格保留最近 N 条」变「整轮边界保留」，测试同步更新。
