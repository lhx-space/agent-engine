# @lhx-agent-engine/plugin-rules

Rule context injection plugin: registers a `ContextContributor` that injects `always` rules in full and retrieves `on-demand` rules (BM25, or BM25 + vector RRF when an embedding provider is supplied) into the system prompt on every run.

The plugin builds its own index (MiniSearch + optional `InMemoryVectorStore`) and reuses core's `hybridRetrieve` for retrieval orchestration — it does not depend on core's `CapabilityLoader`/`CapabilityRegistry`.

## Install

```bash
pnpm add @lhx-agent-engine/plugin-rules
```

## Usage

```ts
import { createRulesPlugin } from '@lhx-agent-engine/plugin-rules';

const rulesPlugin = createRulesPlugin(config.rules, {
  embedding: embeddingProvider, // optional; BM25-only when omitted
  topK: 5,
});

// 装配时传入 plugins: [rulesPlugin]
```

> In config, the `rules` slice is interpreted by this plugin (D1-A: field unchanged, zero migration). Assembly is provided by the composition layer (`@lhx-agent-engine/preset-default` in Phase 4), not by core.
>
> ```yaml
> rules:
>   - id: concise
>     kind: always
>     description: 简洁回答
>     content: 回答要简洁
>   - id: vue-ts
>     kind: on-demand
>     description: Vue3 TypeScript 编码规范
>     content: 使用 <script setup> 语法
>     tags: [vue]
> ```

## API

- `createRulesPlugin(rules, options?)` — returns a `Plugin` that registers a `ContextContributor`.
- `loadRulesText(rules, onDemand)` — pure helper: `always` rules in full + retrieved `on-demand` rules, deduped and joined.
- `RulesPluginOptions` — `{ embedding?, topK? }`.
