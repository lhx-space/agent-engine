## ADDED Requirements

### Requirement: CapabilityLoader 统一加载

系统 SHALL 提供 `CapabilityLoader<T>`，接收能力记录（含 `id` / `description` / `tags`）与 `type`，统一注册进 `CapabilityRegistry` 并按 query BM25 检索，返回命中的记录（含 `score`）。

#### Scenario: 注册与检索

- **WHEN** 以 `type='rule'` 构造 `CapabilityLoader` 并注册若干记录
- **THEN** `loadForQuery` 返回命中的 `{ record, score }` 列表

#### Scenario: 按 type 过滤

- **WHEN** 注册表混有 rule / skill 记录
- **THEN** `CapabilityLoader('rule')` 的 `loadForQuery` 只返回 `type='rule'` 的记录

## MODIFIED Requirements

### Requirement: rules 按需加载

系统 SHALL 提供 `loadRulesText(rules, loader, query, topK)`：`always` 规则的 content 全部注入 + `on-demand` 规则经 `CapabilityLoader` BM25 召回 top-k 的 content，去重拼接，输出「本次注入的规则文本」。

#### Scenario: always 规则强制注入

- **WHEN** 存在 `kind='always'` 的规则
- **THEN** 其 content 无条件包含在输出文本中

#### Scenario: on-demand 规则按需召回

- **WHEN** 存在 `kind='on-demand'` 的规则且与 query 相关
- **THEN** 其 content 经 BM25 召回后注入；不相关的规则不注入
