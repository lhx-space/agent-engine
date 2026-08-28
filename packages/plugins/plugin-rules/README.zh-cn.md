# @lhx-agent-engine/plugin-rules

规则上下文注入插件：注册一个 `ContextContributor`，每次 run 把 `always` 规则全量注入、`on-demand` 规则经检索（BM25；提供 embedding 时 BM25 + 向量 RRF）注入 system prompt。

插件自建索引（MiniSearch + 可选 `InMemoryVectorStore`），检索编排复用 core 的 `hybridRetrieve`——不依赖 core 的 `CapabilityLoader`/`CapabilityRegistry`。

## 安装

```bash
pnpm add @lhx-agent-engine/plugin-rules
```

## 用法

```ts
import { createRulesPlugin } from '@lhx-agent-engine/plugin-rules';

const rulesPlugin = createRulesPlugin(config.rules, {
  embedding: embeddingProvider, // 可选；不传时仅 BM25
  topK: 5,
});

// 装配时传入 plugins: [rulesPlugin]
```

> 配置里的 `rules` 切片由本插件解释（D1-A：字段不变、零迁移）。装配由组合层（Phase 4 的 `@lhx-agent-engine/preset-default`）提供，core 不装配：
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

- `createRulesPlugin(rules, options?)` — 返回注册 `ContextContributor` 的 `Plugin`。
- `loadRulesText(rules, onDemand)` — 纯函数：`always` 规则全量 + 检索命中的 `on-demand` 规则，去重拼接。
- `RulesPluginOptions` — `{ embedding?, topK? }`。
