## Why

能力检索链路（`RuleLoader.loadForQuery` + `buildSystemPrompt`）已就绪，但 **AgentLoop 内部没有任何检索调用**——检索只能靠调用方手动把 `buildSystemPrompt` 包装成函数式 `systemPrompt` 传入。这违背「配置即 Agent」：使用者不该手写组装样板代码。

同时，guardrail 与上下文规则在 `AgentLoopOptions` 里共用 `rules` 命名（`rules?: RuleRegistry` 实为 guardrail，而 `AgentConfig.rules` 是上下文规则），语义冲突。AGENTS.md 5.3 已明确「guardrail 独立于 rules」，代码应跟进。

## What Changes

- **`SystemPromptInput` 扩展**：`string | SystemPrompt（模板对象）| 函数`。
- **AgentLoop 内建检索**：`systemPrompt` 为模板对象时，配合 `rules`（上下文规则）每次 run 自动「渲染模板 + 检索注入」，无需外部包装函数。
- **字段语义收口**：`AgentLoopOptions.rules?: Rule[]`（上下文规则，新语义）；guardrail 注册表改名 `guardrails?: RuleRegistry`。

## Capabilities

### Modified Capabilities

- `agent-loop`: 内建规则检索注入（systemPrompt 模板对象形态）+ guardrails 字段改名。

## Impact

- 修改 `packages/core/src/agent/loop.ts`（类型 + 内建检索 + 字段改名）。
- 修改 `packages/core/tests/rules.test.ts`（guardrails 改名）与 `packages/core/tests/agent-loop.test.ts`（新增检索注入测试）。
- 无新增依赖；无运行时 breaking（guardrails 为内部 API 未发布）。
