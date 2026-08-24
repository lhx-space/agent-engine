## Context

后端已有 NDJSON 事件流（step_start / llm_delta / tool_call / tool_result / hook / done / error）。前端要把这些事件消费成「流式 markdown 对话」。关键约束：复用成熟库（`@ant-design/x` 气泡 + `react-markdown`），流式渲染要节流（不能每个 token 都触发 markdown 解析 + React 渲染）。

## Goals / Non-Goals

**Goals:**

- 左列长对话 chat 面板，多轮消息可见。
- assistant 消息 markdown 渲染（GFM）。
- 流式消费 NDJSON，token 入 buffer，rAF 节流渲染。
- 步骤时间线：tool/hook 每步可见。

**Non-Goals:**

- 不做代码高亮（首版 react-markdown 默认，后续再接 `@ant-design/x` 的 CodeHighlighter）。
- 不做多会话管理 / 历史持久化（单会话内存态，后续接 memory 后端）。
- 不做流中断 / 续传（AbortController 由发送按钮控制，中断即视为结束）。

## Decisions

### D1: markdown 用 react-markdown + remark-gfm，气泡用 @ant-design/x Bubble

**选择**：`Bubble` 只做气泡容器与 `contentRender` 插槽，`contentRender` 内用 `react-markdown` 渲染；`@ant-design/x` 的 `streaming`/`typing` 属性做逐字动画。

**理由**：`@ant-design/x` 与 antd 6 同源、Bubble 提供了 loading/streaming/typing 全套聊天 UI；但它的 markdown 能力只有 code-highlighter 没有完整 AST 渲染，故补 `react-markdown`（最成熟的 React markdown 库）。复用优先，不自己写解析器。

### D2: 流式节流 = buffer + requestAnimationFrame

**选择**：`llm_delta` 事件追加到 `pendingRef`（累积完整文本），用 `requestAnimationFrame` 调度一次 flush；同一帧内多次 delta 只触发一次 setState。

**理由**：这是豆包/DeepSeek/Qwen 的通用做法——「双状态模型」：累积 buffer（完整文本，供最终态）与渲染状态（节流后）。避免每 token 一次 React 渲染 + markdown AST 解析（后者 CPU 密集）。rAF 比 setTimeout 更贴合浏览器帧率，不丢帧也不浪费。

### D3: markdown 解析在 flush 后统一做，流式中同样渲染

**选择**：每次 flush 后的完整文本直接交给 react-markdown 渲染，不区分「流式中/结束」。

**理由**：rAF 节流已经把解析频率压到每帧一次（~16ms），足够快；再加「流式中禁用 markdown、结束时才渲染」会引入内容跳变，体验更差。若未来量大再引入「未闭合代码块防闪烁」专项优化（D4 留口子）。

### D4: 步骤时间线折叠，不阻塞主对话流

**选择**：`tool_call` / `tool_result` / `hook` 事件累积到消息的 `steps` 数组，用 antd `Collapse`/`Steps` 折叠展示在该消息下方。

**理由**：「把每一步清晰化」是可观测诉求，但要默认折叠避免刷屏；用户点开能看到 hook 在哪个点、耗时、是否改写、工具名与结果。

### D5: 事件类型后端/前端各一份，用 `as const` 判别

**选择**：前端 `stream-agent.ts` 里定义 `StreamEvent` 判别联合（与 core 的 `AgentRunEvent` 结构一致），按 `type` 分派。

**理由**：web 不能 import core（core 含 node 运行时依赖）；事件契约靠 stage-1 的 spec 对齐，前端独立声明一份最小结构。

## Risks / Trade-offs

- [react-markdown 流式高频重解析] → rAF 节流压制到每帧一次；后续可加「未闭合代码块防闪烁」。
- [Bubble typing 动画与 markdown 冲突] → `streaming` + `contentRender` 组合；若 typing 动画对 markdown 不生效，降级为「直接渲染 + 尾部光标」，不阻塞主链路。
- [NDJSON 跨 chunk 断行] → 读取端维护行缓冲，未遇到 `\n` 前不解析（半个 JSON 行拼在 buffer 里）。
- [AbortController 中断] → 发送按钮在 running 时变为「停止」，中断 fetch；`done`/`error` 收尾状态机。

## Migration Plan

无破坏：后端不动；`RunPanel` 能力并入 `ChatPanel`，旧的 `/api/agent/run`（非流式）保留但前端不再使用。
