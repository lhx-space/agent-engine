## 1. SystemPromptInput 扩展（core）

- [x] 1.1 扩展为 `string | SystemPrompt | 函数`
- [x] 1.2 `resolveSystemPrompt` 支持模板对象（走 `buildSystemPrompt`）

## 2. AgentLoop 内建检索 + 字段收口

- [x] 2.1 `AgentLoopOptions.rules?: Rule[]`（上下文规则）
- [x] 2.2 guardrail 字段改名 `guardrails?: RuleRegistry`
- [x] 2.3 构造函数预构建 `RuleLoader`（rules 非空时）

## 3. 测试

- [x] 3.1 rules.test.ts 的 guardrail 选项改名 `guardrails`
- [x] 3.2 agent-loop.test.ts 新增「模板对象 + rules 自动检索注入」测试

## 4. 文档

- [x] 4.1 OpenSpec delta + tasks
- [x] 4.2 AGENTS.md 同步（loop 内建检索）
