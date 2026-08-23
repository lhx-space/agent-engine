## 1. 类型与构造

- [x] 1.1 定义 `AgentLoopOptions`（provider / registry / systemPrompt / maxSteps / hooks）
- [x] 1.2 定义 `AgentLoopResult`（finalMessage / messages / steps）
- [x] 1.3 定义 `AgentHooks` 接口（四个可选节点方法）
- [x] 1.4 实现 `AgentLoop` 构造函数

## 2. 循环逻辑

- [x] 2.1 组装初始 messages（system + user）
- [x] 2.2 调用 provider.chatCompletion（含 tools 定义）
- [x] 2.3 判断 tool_calls：有则派发，无则终止

## 3. 工具派发与回填

- [x] 3.1 逐个执行 tool_calls，结果构造 role=tool 消息回填
- [x] 3.2 工具执行失败时回填错误信息
- [x] 3.3 assistant 消息（含 toolCalls）追加到 messages

## 4. 终止与 hooks

- [x] 4.1 实现 maxSteps 上限兜底
- [x] 4.2 在四个节点调用注入的 hooks（未注入跳过）

## 5. 导出

- [x] 5.1 在 `packages/core/src/index.ts` 导出 AgentLoop 及其类型

## 6. 测试

- [x] 6.1 单轮直接回答测试
- [x] 6.2 多轮工具循环测试（mock provider 返回 tool_calls 后返回文本）
- [x] 6.3 工具结果回填测试（断言 tool 消息）
- [x] 6.4 maxSteps 兜底测试
- [x] 6.5 工具执行错误回填测试
- [x] 6.6 hooks 调用点测试
