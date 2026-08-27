## 1. 新增 plugin-memory 包

- [x] 1.1 `package.json` / `tsconfig.json` / `tsdown.config.ts`
- [x] 1.2 `src/index.ts`（SemanticMemory + createSemanticMemory）
- [x] 1.3 `README.md` / `README.zh-cn.md`

## 2. core 协议化

- [x] 2.1 `long-term-memory.ts` 删 SemanticMemory + 加 noopLongTermMemory
- [x] 2.2 `assemble` 改为 `options.longTermMemory ?? noopLongTermMemory`
- [x] 2.3 `memory/index.ts` / `index.ts` 同步导出

## 3. 测试迁移

- [x] 3.1 新增 `plugin-memory/tests/memory.test.ts`
- [x] 3.2 迁移 core 的 long-term-memory 测试（保留 AgentLoop 协议用例）

## 4. 校验

- [x] 4.1 `pnpm test` / `typecheck` / `lint` / `spell` / `format:check` / `lint:md` / `build`
- [x] 4.2 `openspec validate --strict`
