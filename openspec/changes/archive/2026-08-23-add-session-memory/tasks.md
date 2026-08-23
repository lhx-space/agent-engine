## 1. ConversationMemory（core/memory/）

- [x] 1.1 实现 `ConversationMemory`（push / append / getMessages / size / clear + maxMessages 窗口裁剪）
- [x] 1.2 新增 `memory/index.ts` 导出

## 2. AgentLoop 集成（core）

- [x] 2.1 `AgentLoopOptions` 增加可选 `memory`
- [x] 2.2 `run` 读取历史拼进 messages，正常结束回写本轮消息（system 之外）
- [x] 2.3 异常路径不回写

## 3. 导出

- [x] 3.1 core 导出 `ConversationMemory` / `ConversationMemoryOptions`

## 4. 测试

- [x] 4.1 `ConversationMemory` 单元测试（追加/读取/清空/裁剪/副本）
- [x] 4.2 AgentLoop 多轮累积历史测试
- [x] 4.3 AgentLoop 异常不回写测试
