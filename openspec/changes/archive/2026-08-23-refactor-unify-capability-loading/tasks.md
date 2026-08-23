## 1. CapabilityLoader 统一加载（core/retrieval/）

- [x] 1.1 定义 `CapabilityRecord` / `CapabilityRecordHit` / `CapabilityLoader<T>`
- [x] 1.2 统一注册 meta + BM25 检索 + type 过滤 + 映射回 record

## 2. rules 加载重构（core/rules/）

- [x] 2.1 `loadRulesText(rules, loader, query, topK)`（always + on-demand + 去重拼接）
- [x] 2.2 删除 `RuleLoader`

## 3. skills 重构（core/skills/）

- [x] 3.1 `Skill.name` → `id`，`tags` 必需
- [x] 3.2 `loadSkillFromPath` 映射 `name` → `id`，`tags` 兜底
- [x] 3.3 删除 `SkillLoader` / `SkillHit`

## 4. buildSystemPrompt 改纯（core/context/）

- [x] 4.1 `ruleLoader` → `rulesText`，去掉 `query` 参数
- [x] 4.2 `BuildSystemPromptOptions` 抽到 `context/types.ts`

## 5. AgentLoop 集成（core/agent/）

- [x] 5.1 `CapabilityLoader<Rule>` + `loadRulesText`
- [x] 5.2 `CapabilityLoader<Skill>` + 工具注册 + 拼 instruction
- [x] 5.3 类型抽到 `agent/types.ts`

## 6. 类型整理

- [x] 6.1 `memory/types.ts`（ConversationMemoryOptions）
- [x] 6.2 `src/types.ts` 集中出口

## 7. 导出

- [x] 7.1 `index.ts` 更新

## 8. 测试

- [x] 8.1 retrieval.test.ts（CapabilityLoader）
- [x] 8.2 rules.test.ts（loadRulesText）
- [x] 8.3 skills.test.ts（CapabilityLoader + Skill.id）
- [x] 8.4 context.test.ts（buildSystemPrompt rulesText）
- [x] 8.5 agent-loop.test.ts + demo.test.ts（Skill.id）
