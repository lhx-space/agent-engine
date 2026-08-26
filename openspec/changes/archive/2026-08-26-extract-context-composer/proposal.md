## Why

上下文组装（检索 rules/skills → 召回记忆 → 取会话窗口 → 拼 messages）目前散在 `AgentLoop.run()` + 私有 `resolveSystemPrompt()`，`AgentLoop` 既跑 ReAct 循环又兼任 prompt 组装，职责耦合（review 确认的核心问题）。补一个独立 `ContextComposer` + `beforeContextCompose` 钩子（外部素材注入锚点），边界即清。

## What Changes

- `context/context-composer.ts`：新增 `ContextComposer`（输入 systemPrompt / rules / skills / memory / longTermMemory，输出 `Message[]` + 命中 skills + 规则/技能文本 + 召回记忆）。
- `AgentLoop`：删除私有 `resolveSystemPrompt` / `appendContext`，构造 `ContextComposer`，`run` 委托其组装。
- hooks：新增 `beforeContextCompose(userInput): Promise<string | void>`（组合前触发一次，返回字符串追加进 system prompt）；`HookPointSchema` 同步加该点。

## Capabilities

### New Capabilities

<!-- 无新增能力目录。 -->

### Modified Capabilities

- `agent-loop`: 新增「上下文组装（ContextComposer）」需求。
- `hooks-pipeline`: 新增 `beforeContextCompose` 钩子。
- `agent-config-schema`: `HookPointSchema` 增 `beforeContextCompose`。

## Impact

- 新增 `packages/core/src/context/context-composer.ts`。
- 修改 `context/{types,index}.ts`、`agent/{types,loop}.ts`、`hooks/{types,pipeline}.ts`、`config/schema/index.ts`、`core/src/{index,types}.ts`。
- 测试：ContextComposer 组装语义 + beforeContextCompose 钩子注入。
- **非破坏**：`AgentLoop` 对外行为不变，仅内部职责抽离；`SystemPromptInput` 从 `agent/types` 迁到 `context/types`（`agent/types` 保持 re-export 兼容）。
