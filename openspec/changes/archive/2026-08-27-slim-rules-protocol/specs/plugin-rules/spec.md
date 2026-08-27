## MODIFIED Requirements

### Requirement: rules 按需加载（loadRulesText）

系统 SHALL 提供 `loadRulesText(rules, onDemand)`：`always` 规则的 content 全部注入 + 检索命中的 `on-demand` 规则（`onDemand`）的 content，去重拼接，输出「本次注入的规则文本」。检索（BM25，或 BM25 + 向量 RRF）SHALL 由 `createRulesPlugin` 内部的自建索引（MiniSearch + 可选向量库，复用 core 的 `hybridRetrieve`）完成；`loadRulesText` SHALL 为纯函数、不内嵌检索、不依赖 `CapabilityLoader`。

#### Scenario: always 规则强制注入

- **WHEN** 存在 `kind='always'` 的规则
- **THEN** 其 content 无条件包含在输出文本中

#### Scenario: on-demand 规则去重拼接

- **WHEN** 传入检索命中的 on-demand 规则列表
- **THEN** 命中的 content 与 always 规则去重后按序拼接；未命中的 on-demand 规则不注入

#### Scenario: 空集合返回空串

- **WHEN** `rules` 为空且 `onDemand` 为空
- **THEN** 输出为空串，不报错
