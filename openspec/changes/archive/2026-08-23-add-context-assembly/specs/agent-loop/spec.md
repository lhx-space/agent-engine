## ADDED Requirements

### Requirement: 动态 systemPrompt

系统 SHALL 支持 `systemPrompt` 为静态字符串或函数式（`(userInput) => string | Promise<string>`）；函数式在每次 `run` 时按 userInput 动态解析。

#### Scenario: 静态 systemPrompt

- **WHEN** 注入字符串 `systemPrompt`
- **THEN** 循环以该字符串作为 system 消息内容，行为与以往一致

#### Scenario: 函数式动态 systemPrompt

- **WHEN** 注入函数 `(userInput) => string` 形式的 systemPrompt
- **THEN** `run` 时以 userInput 调用该函数，返回值作为本次 system 消息内容

#### Scenario: 异步函数式 systemPrompt

- **WHEN** 注入 `(userInput) => Promise<string>` 形式的 systemPrompt
- **THEN** `run` 时等待其 resolve，返回值作为本次 system 消息内容
