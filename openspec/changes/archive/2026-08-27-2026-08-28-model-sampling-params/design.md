## Context

L1 范围锁定为「常用采样集」：`top_p` / `frequency_penalty` / `presence_penalty` / `stop` / `seed`，openai-compatible（DeepSeek 全支持）与 anthropic 取交集归一化。阅读现有实现后发现 `model.temperature` / `maxTokens` 是死配置（Provider 只读 `params.*`，而 AgentLoop 从不把 config 值注入 params），本 change 一并对齐为「配置缺省 + 调用覆盖」。

## Goals / Non-Goals

**Goals:**

- `ModelConfigSchema` 新增 5 个可选采样字段，带范围校验。
- Provider 以「`params.X ?? config.X`」语义透传，修复 temperature / maxTokens 死配置。
- 每个 provider 只透传其协议支持的字段，不支持的静默忽略（跨 provider 归一化）。

**Non-Goals:**

- 不做 `top_k` / `min_p` / `logit_bias` / `logprobs` / `tool_choice` / `parallel_tool_calls` / `response_format(json_schema)` / 推理参数（属 L2/L3）。
- 不做 vendor 原生参数透传兜底 `extra`（L4）。
- 不改 `AgentLoop` / `assemble` 的参数注入路径（Provider 关闭在 config 上，天然承载缺省值）。

## Decisions

### D1: 「配置缺省 + 调用覆盖」语义

**选择**：Provider 工厂关闭 `config`（与 `baseURL` 一致），`baseRequest` 用 `params.temperature ?? config.temperature` 等合并；`ChatCompletionParams` 同名字段为可选覆盖。

**理由**：最小侵入，不改 AgentLoop/assemble；`ChatCompletionParams` 仍是「单次调用」接口，结构化输出 / 摘要器等内部调用可按需覆盖（如摘要器可给更低 temperature）。与社区 `Settings.llm` 缺省值模式一致。

### D2: 跨 provider 取交集、静默忽略

**选择**：openai-compatible 透传 `temperature`/`top_p`/`max_tokens`/`frequency_penalty`/`presence_penalty`/`stop`/`seed`；anthropic 透传 `temperature`/`top_p`/`max_tokens`/`stop_sequences`，其余忽略。

**理由**：归一化协议层不做「不支持即抛错」（那会让同一份配置无法跨 provider 复用）；厂商差异收敛到各 Provider 适配层，符合「可插拔 Provider」理念。anthropic 的 `stop_sequences` 仅当非空数组才透传（其 API 拒绝空数组）。

### D3: 新增字段 camelCase、范围 Zod 校验

**选择**：config 用 camelCase（`topP`，与既有 `maxTokens`、`documents.topK` 一致）；`topP` 限 [0,1]、`frequencyPenalty`/`presencePenalty` 限 [-2,2]、`seed` 限 int。

**理由**：config 面向用户、Zod 在配置加载边界即拦截非法值（单一事实来源 + 早失败），不等到底层 SDK 报错。

## Risks / Trade-offs

- [`temperature`/`maxTokens` 行为变化] 修复后这两个字段真正生效，此前配置了它们但实际未生效的用户，输出分布可能变化。属「修复 bug」而非「破坏兼容」，字段名与取值范围不变。
- [anthropic 忽略部分字段] 配置了 `frequencyPenalty` 等但 provider=anthropic 时静默不生效；这是跨 provider 归一化的既定取舍（D2），文档注明即可。
- [DeepSeek reasoner 忽略采样] `deepseek-reasoner` 会忽略 temperature/top_p 等；这是上游模型行为，本 change 不拦截（仍透传，由上游决定）。

## Migration Plan

- 旧配置零迁移：新增字段可选、缺省 undefined；`temperature`/`maxTokens` 字段名不变。
- 无 schema 破坏性变更；文档（README/AGENTS）示例同步补充新字段（随 docs commit 一并更新）。
