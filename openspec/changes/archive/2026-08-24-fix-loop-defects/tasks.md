## 1. memory 整轮边界裁剪

- [x] 1.1 `ConversationMemory.trim()` 裁剪点对齐到 user 消息起点，不拆散 tool_call ↔ tool 结果
- [x] 1.2 预算内无轮次起点时，退回到最近 user，保留最近一个完整轮次

## 2. rules/skills 兜底注入

- [x] 2.1 `resolveSystemPrompt` string 形态兜底追加 rulesText/skillsText
- [x] 2.2 `resolveSystemPrompt` 函数形态兜底追加 rulesText/skillsText

## 3. skill 工具清理

- [x] 3.1 `ToolRegistry.unregister(name)`（按名移除，返回是否移除）
- [x] 3.2 `AgentLoop.run` 记录本轮注册的 skill 工具（含覆盖前的同名工具），结束（含异常）时还原/移除

## 4. 测试

- [x] 4.1 `memory.test.ts`：更新「保留最近 N 条」为整轮边界断言 + 新增 tool_call 配对不拆散用例
- [x] 4.2 `agent-loop.test.ts`：string/function systemPrompt 兜底注入 rules；skills 工具 run 结束清理
- [x] 4.3 `tools.test.ts`：unregister 用例 + jsonSchema 透传用例
