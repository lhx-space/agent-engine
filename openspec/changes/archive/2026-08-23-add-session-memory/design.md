## Context

`AgentLoop.run` 目前无状态：每次调用重建 `[system, user]`，run 之间丢历史，无法多轮对话。5.4「上下文层」已落地 system-prompt 组装（`buildSystemPrompt`），本 change 补齐「会话上下文」这一半。

## Goals / Non-Goals

**Goals:**

- 实现 `ConversationMemory`：消息历史管理 + `maxMessages` 窗口裁剪。
- AgentLoop 注入 `memory` 后跨 run 累积历史，实现多轮对话。

**Non-Goals:**

- 不做长期记忆（`MemoryBackend` / 向量检索）—— M3。
- 不做窗口「压缩」（LLM 摘要压缩）—— 后续。
- 不做多会话管理（session id / 会话并存）—— 后续。
- 不做 config 装配层（从 `memory.session.maxMessages` 自动装配）—— 后续 resolve 模块。

## Decisions

### D1: ConversationMemory 不存 system

**选择**：`ConversationMemory` 只管理 user / assistant / tool 历史，不存 system。

**理由**：system prompt 每次 run 由 `buildSystemPrompt` 动态组装（含 rules 检索），存入历史会复用旧 prompt。类本身不做 role 过滤（保持通用），由 AgentLoop 集成时约定「只回写 system 之外的消息」。

### D2: 窗口裁剪只「丢弃最旧」，不压缩

**选择**：`maxMessages` 超限时 `splice` 丢弃最旧 N 条；不引入 LLM 摘要压缩。

**理由**：裁剪是确定性、零成本的兜底；压缩需额外 LLM 调用、有延迟与成本，且摘要质量不可控。压缩留后续作为可选策略。

### D3: AgentLoop 通过 `memory` 选项注入，不内建会话状态

**选择**：`AgentLoopOptions.memory?: ConversationMemory`，可选注入；`run` 仍是「单次执行」语义，历史由外部 `ConversationMemory` 持有。

**理由**：保持 AgentLoop 可无状态复用（不注入 memory 则行为不变），会话生命周期（何时 `clear`）由调用方控制，符合「内核与状态解耦」。

**备选**：AgentLoop 内建 `startSession()` / 内部数组。缺点：会话生命周期硬编码进内核，多会话/持久化难扩展。**否决**。

### D4: 异常不回写

**选择**：仅正常结束（自然终止 / maxSteps 兜底）时把本轮消息写回 memory；异常抛出时保持 memory 不变。

**理由**：异常时的消息序列可能不完整/含错误中间态，回写会污染后续轮次；失败轮的上下文由调用方决定是否保留。

## Risks / Trade-offs

- [窗口裁剪丢旧消息] → 久远上下文丢失不可避免，`maxMessages` 由配置控制；压缩（摘要）留后续缓解。
- [memory 由调用方持有] → 多 Agent 场景需各自维护 memory 实例；与 6.3 的「subagent 独立作用域」方向一致。
- [回写含 user 消息] → 历史天然包含用户输入，多轮追问依赖此行为；符合对话惯例。

## Migration Plan

无迁移：`memory` 为可选增量，不注入时行为与现状一致。
