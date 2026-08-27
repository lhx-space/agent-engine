# 内核瘦身重构规划

> 目标：把内核从「能力各占一个一等公民模块」收敛为「薄引擎 + 统一扩展缝」。本文档是重构的**唯一规划真相源**，后续每个 Phase 的 OpenSpec change 都引用它。

## 一、背景与问题

当前 rules / skills / documents / memory 等在引擎里各占一个一等公民模块，各自硬编码了一份「匹配 meta → 检索 → 注入 context」的能力管线。由此带来：

- **横切成本高**：社区冒出新概念「xxx」，要改 config schema、新 loader、`ContextComposer` 硬分支、`AgentLoop` 特殊处理等 6~8 个文件。
- **检索逻辑重复**：BM25 + 向量 RRF 混合检索，同时写在 `retrieval/registry.ts` 与 `documents/document-index.ts` 两份。
- **注入逻辑分散**：`ContextComposer` 硬编码 `ruleLoader / skillLoader / documentIndex / longTermMemory` 四条分支；skill 工具注册在 `AgentLoop.run` 特殊处理。
- **闭合枚举**：`CapabilityType = 'rule' | 'skill' | 'mcp-tool' | 'plugin'`，新概念要改类型。
- **插拔点形同虚设**：`Retriever` / `Reranker` 接口已声明，但主路径（rules/skills/docs）未走它们。

## 二、目标架构

```text
config（只定义内核骨架 schema + 插件注册）
   ↓
core（内核：只做「怎么执行」）
   ↓
plugins（能力：全部外置，各一个包，走统一缝接入）
```

内核只认四样东西：**怎么循环、怎么调模型、怎么扩展、怎么拦截**。其余能力（rules/skills/documents/memory/web/mcp）都是「往 context 贡献一段文本 / 注册几个工具」，统一收敛成一个原语。

## 三、边界清单

### ✅ 留在内核（core）

| 模块                                                                                      | 为什么属于内核                 |
| ----------------------------------------------------------------------------------------- | ------------------------------ |
| `AgentLoop`（ReAct 循环）                                                                 | 引擎心脏                       |
| `LLMProvider`                                                                             | 模型接入原语                   |
| `Tool` + `ToolRegistry`                                                                   | 运行时能力的唯一原语           |
| `ConversationMemory`（会话窗口）                                                          | run 的状态                     |
| `Plugin` + `PluginContext`                                                                | 唯一扩展缝                     |
| `Hooks`（生命周期拦截）                                                                   | 「怎么执行」的观察/改写        |
| `Guardrails`（`RuleRegistry` + declarative）                                              | 「怎么执行」的安全硬边界       |
| `EventBus`                                                                                | 可观测                         |
| `AgentConfig`（内核骨架 schema）                                                          | 声明式表面                     |
| `Retriever` / `Reranker` 接口 + 唯一 `hybridRetrieve`                                     | 检索策略（能力共用）           |
| `EmbeddingProvider` / `VectorStore` / `CacheBackend` / `MemoryBackend` / `SandboxBackend` | 后端抽象（接口 + 默认 + 注入） |
| `structured-output` / `context`（模板/token/裁剪原语）                                    | 组装原语                       |

### ➡️ 外放成插件包

| 现在在 core                                     | 迁移到                           |
| ----------------------------------------------- | -------------------------------- |
| rules 文本注入                                  | `@agent-engine/plugin-rules`     |
| skills（检索 + 工具注册 + `loadSkillFromPath`） | `@agent-engine/plugin-skills`    |
| documents / RAG                                 | `@agent-engine/plugin-documents` |
| 长期语义记忆（`SemanticMemory`）                | `@agent-engine/plugin-memory`    |
| MCP client（两可）                              | `@agent-engine/plugin-mcp`       |
| `web_search` / `web_fetch`                      | `@agent-engine/plugin-web`       |

## 四、关键决策点（先拍板，再写代码）

- **D1 配置归属**：能力迁走后 `rules / skills / documents / memory.longTerm / mcp` 字段归谁。
  - 方案 A：YAML 字段不变，解释权移交插件（内核只透传 config，插件读自己切片）。用户零迁移。
  - 方案 B：插件注册自己的 Zod 子 schema，`AgentConfig` 只留骨架 + `plugins[].config`。更彻底，但「单一事实来源」要重设计。
  - **倾向：先 A 后 B。**
- **D2 统一缝形状**：`ContextContributor.contribute()` 的入参/返回与工具生命周期（临时注册 vs 常驻）。
- **D3 检索策略归属**：`Retriever`（含 `hybridRetrieve`）留 core；「索引构建」归插件——能力自建索引，复用 core 的混合检索。RRF 只此一份。
- **D4 MCP 归属**：core 留「外部工具来源」薄接口（`ToolSource`），MCP 实现放 `plugin-mcp`；或纯插件。二选一。
- **D5 开箱即用**：全外放后要 `@agent-engine/preset-default`（全家桶），否则用户装 5 个包才能干活。

## 五、分阶段路线

### Phase 0 —— 止血：统一混合检索（消 RRF 重复）

- **目标**：把「BM25 召回 → embed query → 向量 query → RRF 融合」编排从两份收敛成一份 `hybridRetrieve`。
- **产出**：`core/retrieval/hybrid-retriever.ts`；`CapabilityRegistry` 与 `DocumentIndex` 改为委托。
- **验收**：行为零变化（文档查询的语义失败回落随本次对齐为 best-effort）；`reciprocalRankFusion` 只被一处调用。
- **OpenSpec**：`unify-hybrid-retriever`。

### Phase 1 —— 加缝：引入 ContextContributor（旧路径共存）

- **目标**：内核加 `ContextContributor` 接口 + `PluginContext.registerContextContributor` + `CapabilityBundle` 承载 + `AgentLoop` 收集。
- **验收**：插件能用新缝；旧能力仍走旧路径，行为不变。
- **OpenSpec**：`add-context-contributor`。

### Phase 2 —— 迁移：逐个把能力迁成插件包

每个能力 = 一个包 + 一个独立 commit + 一次全量校验，按依赖从简到繁：

| 顺序 | 包                 | 迁走                                        | 内核删                                      |
| ---- | ------------------ | ------------------------------------------- | ------------------------------------------- |
| 2a   | `plugin-rules`     | `loadRulesText` + rule 检索注入             | `rules/load.ts`、`CapabilityLoader('rule')` |
| 2b   | `plugin-skills`    | skill 检索 + 工具注册 + `loadSkillFromPath` | `skills/`、skill 硬分支                     |
| 2c   | `plugin-documents` | `DocumentIndex` + normalizers + chunkers    | `documents/` 全部                           |
| 2d   | `plugin-memory`    | `SemanticMemory`                            | `memory/long-term-memory.ts`                |
| 2e   | `plugin-web`       | `web_search` / `web_fetch`                  | 内置原语里的 web                            |
| 2f   | `plugin-mcp`       | MCP client                                  | `mcp/`（视 D4）                             |

### Phase 3 —— 瘦身：删闭合枚举与硬分支，config 骨架化

- **目标**：删 `CapabilityType` 闭合 union、`CapabilityLoader`/`CapabilityRegistry`；删 `ContextComposer` 四条硬分支；`AgentConfig` 只留骨架轴。
- **验收**：新概念接入只需注册 contributor，core 零改动。
- **OpenSpec**：`slim-core-capability-axes`。

### Phase 4 —— 体验：全家桶 + 迁移指南

- **目标**：`@agent-engine/preset-default` 聚合全部能力插件，config 一行还原今天的能力。
- **OpenSpec**：`preset-default`。

## 六、兼容与回滚

1. **配置兼容**（D1-A）：现有 `agent.yaml` 字段解释权移交后，用户 YAML 不改——硬约束。
2. **每阶段独立可回滚**：Phase 0~2 每步可单独 revert。
3. **依赖方向不变**：`config ← core ← plugins`。

## 七、启动顺序

1. 拍板 D1/D2/D4/D5（尤其 D1）。
2. 先做 Phase 0（零风险），同时把 Phase 1 的 `ContextContributor` 接口形状在同一个 PR 讨论里定稿。
3. Phase 2 先跑通 `plugin-rules` 形成「迁包 + 测试迁移 + 全量校验」模板，再复制。
