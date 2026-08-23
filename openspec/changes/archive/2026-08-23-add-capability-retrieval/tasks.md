## 1. RuleSchema 修正（config）

- [x] 1.1 定义 `RuleKindSchema`（always / on-demand）
- [x] 1.2 重构 `RuleSchema` 为 id + kind + description + content + tags
- [x] 1.3 更新关联类型（删除 static/guardrail 的 discriminatedUnion）
- [x] 1.4 更新 config 包测试

## 2. CapabilityRegistry（core）

- [x] 2.1 定义 `CapabilityMeta`（id / type / description / tags）
- [x] 2.2 实现 `CapabilityRegistry`（register / 按 type 过滤）

## 3. BM25 检索器（core）

- [x] 3.1 集成 minisearch + Intl.Segmenter 中文分词
- [x] 3.2 实现 `retrieve(query, topK)` 返回含 score 的候选

## 4. rules 按需加载（core）

- [x] 4.1 实现 `loadRulesForQuery(query, topK)`：always 全注入 + on-demand 召回
- [x] 4.2 实现 C1 空集合兜底（返回空文本）

## 5. 导出

- [x] 5.1 在 core 导出 CapabilityRegistry / 检索器 / loadRulesForQuery

## 6. 测试

- [x] 6.1 RuleSchema 新形态测试（kind 默认值 / content / tags）
- [x] 6.2 CapabilityRegistry 注册与过滤测试
- [x] 6.3 关键词召回测试（含 score）
- [x] 6.4 always 强制注入 + on-demand 召回测试
- [x] 6.5 C1 空集合兜底测试
