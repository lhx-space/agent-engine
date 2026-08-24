## Context

流式 + 工具调用首次端到端暴露了「空参数污染历史」和「内置工具被配置误过滤」两个问题。核心原则：**内核必须容错 LLM 的不完美输出**（空参数、坏 JSON），且**内置能力默认可用，配置只做增量**。

## Goals / Non-Goals

**Goals:**

- 空/非法工具入参不崩、不污染历史。
- 内置工具恒全注册，不因 `tools` 配置被过滤。
- demo 默认 read_file 可用。

**Non-Goals:**

- 不实现 `tools` 的非内置引用解析（横向拓展的工具仍走 plugins/mcp/skills 各自装配）。
- 不做工具参数的自动补全/重试（只兜底为 `{}`）。

## Decisions

### D1: 入参规范化在 loop 层做，registry 层做兜底

**选择**：`AgentLoop` 在执行工具前把 `toolCall.function.arguments` 规范化为合法 JSON（空/非法 → `{}`），并写回 `toolCall`（同一对象引用，`messages` 里的历史随之更新）；`ToolRegistry.execute` 同样兜底（防御性，防止直接调用方传入空串）。

**理由**：崩溃根因是「空 arguments 被写进历史，下一轮服务端解析失败」。规范化的最佳位置在 loop——它拥有 `toolCall` 引用，写回后历史与执行入参天然一致。registry 兜底是第二道防线（幂等）。

### D2: 内置工具恒全注册，移除 `tools` 过滤

**选择**：`registerBuiltinTools` 删除 `want(name)` 过滤逻辑，`tools` 参数不再参与内置工具的选择。

**理由**：内置工具是系统默认能力，应始终可用；`tools` 配置是「横向拓展」（额外工具引用）。原来的过滤语义反了——显式声明一个反而过滤掉其余全部，违反直觉。bash 仍由 `security.bash.enabled` 控制（安全默认）。

### D3: 空参数统一兜底 `{}`

**选择**：空串 / 空白 / `JSON.parse` 失败的入参都归一为 `{}`，交给工具自己的 `inputSchema` 校验（如 read_file 会报 `path` 必填），而不是在 registry 抛 `invalid JSON`。

**理由**：`{}` 走 Zod 校验能给出更友好的「缺字段」错误，且保证历史里永远是合法 JSON。

## Risks / Trade-offs

- [空参数被静默当成 `{}`] → 可能掩盖模型「想传参数但格式错了」的信号；但相比崩溃，兜底 + 工具自身校验报错是更可接受的折中。
- [移除 tools 过滤是否破坏现有用法] → `tools: [{use: builtin.read_file}]` 现在语义变为「额外引用（无副作用）」，内置仍全注册；不破坏，只是不再「收窄」。

## Migration Plan

无破坏。`tools` 字段保留，语义从「内置过滤」转为「额外工具引用」。
