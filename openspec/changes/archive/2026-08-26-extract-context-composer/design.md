## Context

review 结论：`AgentLoop` 兼任「ReAct 循环」与「上下文组装」两个职责，是 memory/context 边界模糊的根源。本 change 抽离 `ContextComposer` 并补 `beforeContextCompose` 钩子。

## Goals / Non-Goals

**Goals:** 抽 `ContextComposer`；`AgentLoop` 只跑 ReAct；补 `beforeContextCompose`。

**Non-Goals:** 不做工业级加载策略（RRF/reranker 消费等 P3）；不新增 config 字段。

## Decisions

- **D1** `ContextComposer` 放 `context/`，`SystemPromptInput` 迁到 `context/types`（`agent/types` re-export 兼容）。避免 context→agent 循环依赖。
- **D2** `compose(userInput, injectedFragment?)` 返回 `{ messages, skillHits, ... }`；skill 工具注册副作用留在 `AgentLoop`（属 registry 职责），composer 只返回命中。
- **D3** `beforeContextCompose` 语义 = 「组合前触发一次」，返回字符串则作为外部素材追加进 system prompt（claude.md / 项目摘要注入锚点）；`beforeLLM` 仍负责每步改写。

## Risks / Trade-offs

- [行为等价] → 纯重构，测试锁定组装语义。
- [hook 增多] → 新增一个「组合前」锚点，不与循环级 beforeLLM 混用。

## Migration Plan

- 无破坏；`SystemPromptInput` 仍可从 `@agent-engine/core/agent` 导入。
