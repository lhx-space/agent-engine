## 1. 新增 @agent-engine/plugin-rules 包

- [x] 1.1 `package.json` / `tsconfig.json` / `tsdown.config.ts`
- [x] 1.2 `src/index.ts`：`createRulesPlugin(rules, options?)` + `loadRulesText` + `RulesPluginOptions`
- [x] 1.3 `README.md` / `README.zh-cn.md`

## 2. core 删除 rules 硬路径

- [x] 2.1 删除 `rules/load.ts`
- [x] 2.2 `rules/index.ts` 与 `src/index.ts` 移除 `loadRulesText` 导出
- [x] 2.3 `ContextComposer` 去掉 `rules` / `ruleLoader` / `rulesText`
- [x] 2.4 `AgentLoop` 去掉 `rules` / `ruleLoader` / `CapabilityLoader('rule')`
- [x] 2.5 `agent/types.ts` 去掉 `rules?: Rule[]`

## 3. core 删除 rules 能力轴

- [x] 3.1 `PluginContext` 去掉 `registerRule`
- [x] 3.2 `CapabilityBundle` / `MergedBundles` 去掉 `rules`
- [x] 3.3 `PluginManager` 去掉 `rules` 收集与 `registerRule`
- [x] 3.4 `assemble.ts` 去掉 `rules` 选项与 `rule.loaded` 事件
- [x] 3.5 `events/types.ts` 去掉 `rule.loaded`

## 4. server 装配

- [x] 4.1 `builtin-plugins.ts` 提供 `@agent-engine/plugin-rules` 工厂 + `defaultCapabilityPlugins`
- [x] 4.2 `app.ts` 注入 `defaultPlugins`
- [x] 4.3 `package.json` 加 `@agent-engine/plugin-rules` 依赖

## 5. 测试迁移

- [x] 5.1 新增 `packages/plugins/rules/tests/rules.test.ts`
- [x] 5.2 迁移 `retrieval.test.ts` / `capability-semantic-recall.test.ts`（loadRulesText 用例）
- [x] 5.3 迁移 `context-composer.test.ts` / `events.test.ts` / `resolve.test.ts`

## 6. 校验

- [x] 6.1 `pnpm test` / `typecheck` / `lint` / `spell` / `format:check` / `lint:md` / `build`
- [x] 6.2 `openspec validate --strict`
