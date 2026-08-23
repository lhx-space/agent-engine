## 1. context 模块（core）

- [x] 1.1 实现 `renderTemplate`（`{{var}}` 正则替换；未提供保留原样、null/undefined 空串）
- [x] 1.2 实现 `buildSystemPrompt(query, options)`（用户变量 + 内置 `rules` 变量 + 兜底追加）
- [x] 1.3 新增 `context/index.ts` 导出

## 2. AgentLoop 改造（core）

- [x] 2.1 定义 `SystemPromptInput = string | ((userInput) => string | Promise<string>)`
- [x] 2.2 `AgentLoopOptions.systemPrompt` 放宽为 `SystemPromptInput`
- [x] 2.3 `run` 内新增 `resolveSystemPrompt` 动态解析

## 3. 导出

- [x] 3.1 core 导出 `renderTemplate` / `buildSystemPrompt` / `BuildSystemPromptOptions` / `SystemPromptInput`

## 4. 测试

- [x] 4.1 `renderTemplate` 测试（替换 / 保留原样 / 空值 / 空格点号）
- [x] 4.2 `buildSystemPrompt` 测试（占位符注入 / 兜底追加 / 无 loader / 无匹配）
- [x] 4.3 AgentLoop 函数式 systemPrompt 测试（同步 / 异步）
