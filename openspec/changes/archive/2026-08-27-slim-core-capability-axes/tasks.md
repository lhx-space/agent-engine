## 1. 删闭合枚举与能力检索实现

- [x] 1.1 删 `retrieval/{loader,registry,types}.ts`
- [x] 1.2 `retriever.ts` 删 Bm25Retriever + 加 noopRetriever
- [x] 1.3 `assemble` / `index.ts` / `types.ts` 同步

## 2. 死依赖清理

- [x] 2.1 core `package.json` 移除 minisearch / mammoth / epub2 / turndown / unpdf / gray-matter / readability / linkedom

## 3. 测试迁移

- [x] 3.1 删 retrieval / capability-semantic-recall 测试
- [x] 3.2 context-retrieval 改 retriever 断言

## 4. 校验

- [x] 4.1 `pnpm test` / `typecheck` / `lint` / `spell` / `format:check` / `lint:md` / `build`
- [x] 4.2 `openspec validate --strict`
