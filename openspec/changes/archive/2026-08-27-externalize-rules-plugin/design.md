## Context

Phase 1 加了 `ContextContributor` 缝，但 rules 能力仍以 core 一等公民存在：`loadRulesText`（`rules/load.ts`）+ `ContextComposer.ruleLoader` 分支 + `AgentLoop` 内联 `new CapabilityLoader('rule')`。本 change 把 rules 文本注入迁到 `@lhx-agent-engine/plugin-rules`，验证「能力包 + ContextContributor 统一缝」模板。

## Goals / Non-Goals

**Goals:**

- rules 文本注入外放为 `@lhx-agent-engine/plugin-rules`，走 `ContextContributor` 统一缝。
- core 删除 rules 硬路径（`loadRulesText` / `ruleLoader` / `CapabilityLoader('rule')`）与 rules 能力轴（`registerRule` / `bundle.rules` / `rule.loaded`）。
- `config.rules` 零迁移（D1-A）：字段不变，server 自动装配插件。

**Non-Goals:**

- 不动 guardrail（`RuleRegistry` / `declarative` / `registerGuardrail`），那是安全硬边界。
- 不动 skills / documents / memory / web / mcp（后续 2b~2f）。
- 不删 `CapabilityLoader` / `CapabilityRegistry` / `hybridRetrieve`（Phase 3 再瘦身）。
- 不改检索算法与 `{{rules}}` 模板占位符语义。

## Decisions

### D1: rules 检索逻辑经 `CapabilityLoader` 复用（Phase 2 过渡）

**选择**：`plugin-rules` 内部用 core 现有 `CapabilityLoader<Rule>('rule', rules, { embedding })` 做检索，`loadRulesText` 纯函数迁入本包做「always + on-demand 去重拼接」。

**理由**：D3 已定「检索策略留 core、索引构建归插件」。`CapabilityLoader` / `CapabilityRegistry` 目前仍在 core（Phase 3 删），迁移期直接复用避免重复造轮子；Phase 3 瘦身时再把 `plugin-rules` 切到自建索引 + `hybridRetrieve`。语义召回（embedding）能力保留不变。

### D2: `config.rules` 由 server 自动装配（D1-A 零迁移）

**选择**：core 新增 `ResolveDeps.defaultPlugins?: string[]`（额外按名实例化的插件，与 `config.plugins` 去重合并）；server 在 `config.rules` 非空时把 `@lhx-agent-engine/plugin-rules` 放入 `defaultPlugins`，并在 `createBuiltinPluginFactories` 提供其工厂 `() => createRulesPlugin(config.rules, { embedding })`。

**理由**：core 保持能力无关（只按名实例化，不硬编码「rules → 插件」映射），「哪个能力切片激活哪个插件」的编排决策留在 server（组合层）。这与 files/bash/git 现有的「server 闭包 config 提供工厂」一致，也为 Phase 4 `preset-default` 铺路。

### D3: `registerRule` 与 `bundle.rules` 随之外放删除

**选择**：`PluginContext.registerRule`、`CapabilityBundle.rules`、`mergeBundles.rules` 一并删除；插件注入规则文本改用 `registerContextContributor`。

**理由**：`registerRule` 的产物最终汇入被删除的 `ruleLoader` 路径，删除后无消费者，留之即死代码。context rule 概念统一收敛到 `ContextContributor`，符合目标架构「能力 = 数据 + contribute()」。

### D4: `rule.loaded` 事件随装配层 rules 合并一起移除

**选择**：`AgentEngineEvent` 移除 `rule.loaded`；装配层不再发该事件。

**理由**：`rule.loaded` 是「装配层加载 rules」的可观测事件；rules 外放后由插件在 `install` 阶段注册 contributor，装配层不再感知 rule，事件失去发出点。skill.loaded 在 2b 迁移前保留。

## Risks / Trade-offs

- [语义召回能力] `createRulesPlugin` 可选接收 `EmbeddingProvider`；server 工厂从 `config.embedding` 构造，语义召回行为与现状一致，但会与 resolve 内 documents/memory 的 provider 各建一个实例（无共享状态，仅多一个 HTTP 客户端）。后续 Phase 2c/2d 统一 provider 生命周期。
- [事件可观测性回退] `rule.loaded` 事件消失，规则加载不再有装配期事件；`ContextContributor` 尚不携带事件钩子。作为过渡接受，后续可给 `PluginContext` 注入 `EventBus` 补齐。
- [API 破坏] `registerRule` 删除是 `PluginContext` 的 breaking change；本仓库内无真实插件使用（仅测试桩），同步更新测试即可，无外部迁移。
