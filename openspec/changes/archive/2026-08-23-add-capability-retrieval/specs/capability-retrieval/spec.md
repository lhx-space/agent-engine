## ADDED Requirements

### Requirement: CapabilityRegistry 统一 meta

系统 SHALL 提供 `CapabilityRegistry`，支持 `register`（注册 meta：`id` / `type` / `description` / `tags`），按 type 区分能力类型。

#### Scenario: 注册与区分类型

- **WHEN** 注册一个 `type='rule'` 的 meta
- **THEN** 该 meta 被纳入索引，可按 type 过滤

### Requirement: BM25 检索

系统 SHALL 提供 `retrieve(query, topK)`，用 minisearch + Intl.Segmenter 分词对 meta（description + tags）打分，返回 top-k 候选（含 `score`）。

#### Scenario: 关键词召回

- **WHEN** 以「Vue 组件怎么写」检索，存在 description 含「Vue3 TypeScript 编码规范」的 rule
- **THEN** 该 rule 被召回且 score 较高

#### Scenario: 输出得分

- **WHEN** 检索返回候选
- **THEN** 每项含 `score`，可用于可观测排查

### Requirement: rules 按需加载

系统 SHALL 提供 `loadRulesForQuery(query, topK)`：`always` 规则的 content 全部注入 + `on-demand` 规则 BM25 召回 top-k 的 content，输出「本次注入的规则文本」。

#### Scenario: always 规则强制注入

- **WHEN** 存在 `kind='always'` 的规则
- **THEN** 其 content 无条件包含在输出文本中

#### Scenario: on-demand 规则按需召回

- **WHEN** 存在 `kind='on-demand'` 的规则且与 query 相关
- **THEN** 其 content 经 BM25 召回后注入；不相关的规则不注入

### Requirement: C1 空集合兜底

当检索无候选时，系统 SHALL 返回空文本（不注入规则），不报错。

#### Scenario: 无匹配规则

- **WHEN** 所有 on-demand 规则均与 query 不相关
- **THEN** 输出为空文本，流程正常继续
