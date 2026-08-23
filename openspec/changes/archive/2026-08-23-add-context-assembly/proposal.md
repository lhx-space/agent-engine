## Why

上一 change（add-capability-retrieval）实现了 `RuleLoader.loadForQuery(query)`——按 user input 检索 rules 并输出「本次注入的规则文本」，但**没有消费方**：`AgentLoop.systemPrompt` 仍是构造时固定的静态字符串，导致 rules 检索结果从未进入 system prompt。

本质矛盾：system prompt 应当是「每次 run 动态组装」的（模板渲染 + rules 按需检索注入），而当前 AgentLoop 把它当作「构造时一次性固定」。

这补齐 AGENTS.md 5.4「system-prompt 组装」与 M2 里程碑的关键一环，让 `config.systemPrompt`（模板 + 变量）与 `config.rules`（检索注入）真正联动。

## What Changes

- **新增 context 模块**：`renderTemplate`（`{{var}}` 模板渲染）与 `buildSystemPrompt(query, options)`（渲染用户变量 + 内置 `rules` 变量注入，模板未声明 `{{rules}}` 时兜底追加）。
- **改造 AgentLoop**：`systemPrompt` 从 `string` 放宽为 `SystemPromptInput = string | ((userInput) => string | Promise<string>)`，每次 `run` 动态解析。
- **导出**：core 导出 context 模块与新类型。

## Capabilities

### New Capabilities

- `context-assembly`: system prompt 动态组装——模板渲染（`{{var}}`）+ rules 按需注入（内置 `rules` 变量 + 兜底追加）。

### Modified Capabilities

- `agent-loop`: `systemPrompt` 支持函数式（`string | (userInput) => string | Promise<string>`），每次 run 动态生成。

## Impact

- 新增 `packages/core/src/context/`（`build-system-prompt.ts` + `index.ts`）。
- 修改 `packages/core/src/agent/loop.ts`（`SystemPromptInput` 类型 + `resolveSystemPrompt`）。
- 修改 `packages/core/src/index.ts`（导出 context 模块与 `SystemPromptInput`）。
- 新增 `packages/core/tests/context.test.ts`；扩展 `packages/core/tests/agent-loop.test.ts`。
- 无 breaking changes：`systemPrompt: string` 仍是 `SystemPromptInput` 的子集，现有调用方不受影响。
