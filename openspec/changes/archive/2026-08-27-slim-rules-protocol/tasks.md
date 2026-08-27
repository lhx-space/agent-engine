## 1. plugin-rules 协议重构

- [x] 1.1 自建 `RuleIndex`（MiniSearch + 可选 `InMemoryVectorStore`）+ `hybridRetrieve`
- [x] 1.2 `loadRulesText` 纯化为 `(rules, onDemand)`
- [x] 1.3 依赖加 `minisearch`

## 2. core 清理

- [x] 2.1 `buildSystemPrompt` 去 `rulesText` / `{{rules}}`
- [x] 2.2 `BuildSystemPromptOptions.rulesText` 删除

## 3. 目录命名

- [x] 3.1 `packages/plugins/rules/` → `packages/plugins/plugin-rules/`

## 4. 测试迁移

- [x] 4.1 更新 `plugin-rules/tests/rules.test.ts`
- [x] 4.2 更新 `context.test.ts`（去 rulesText 用例）

## 5. 校验

- [x] 5.1 `pnpm test` / `typecheck` / `lint` / `spell` / `format:check` / `lint:md` / `build`
- [x] 5.2 `openspec validate --strict`
