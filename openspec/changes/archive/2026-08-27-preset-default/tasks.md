## 1. core 装配协议

- [x] 1.1 `ResolveDeps.defaultPlugins` + `resolve` 去重合并
- [x] 1.2 `ResolveDeps.longTermMemoryFactory` + `assemble` 工厂注入

## 2. 新增 preset-default 包

- [x] 2.1 `package.json` / `tsconfig.json` / `tsdown.config.ts`
- [x] 2.2 `src/index.ts`（createPresetPluginFactories / defaultCapabilityPlugins / createPresetLongTermMemoryFactory）
- [x] 2.3 `tests` / `README`

## 3. server 改用 preset

- [x] 3.1 `app.ts` 用 preset 装配；删 `builtin-plugins.ts`
- [x] 3.2 `package.json` 加 preset-default 依赖

## 4. 校验

- [x] 4.1 `pnpm test` / `typecheck` / `lint` / `spell` / `format:check` / `lint:md` / `build`
- [x] 4.2 `openspec validate --strict`
