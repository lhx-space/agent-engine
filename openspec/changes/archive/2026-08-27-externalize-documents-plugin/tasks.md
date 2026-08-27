## 1. 新增 plugin-documents 包

- [x] 1.1 `package.json` / `tsconfig.json` / `tsdown.config.ts`
- [x] 1.2 `src/{types,chunker,normalizers,html-to-markdown,document-index,index}.ts`
- [x] 1.3 `README.md` / `README.zh-cn.md`

## 2. core 删除 documents 硬路径

- [x] 2.1 删 `documents/` 目录
- [x] 2.2 `ContextComposer` / `AgentLoop` / `assemble` / `resolve` 删 document 路径
- [x] 2.3 `index.ts` / `types.ts` / `tsdown.config.ts` / `package.json` 同步

## 3. 测试迁移

- [x] 3.1 新增 `plugin-documents/tests/{documents,binary-normalizers,document-semantic-recall}.test.ts`
- [x] 3.2 迁移 core 的 documents / binary-normalizers / document-semantic-recall 测试

## 4. 校验

- [x] 4.1 `pnpm test` / `typecheck` / `lint` / `spell` / `format:check` / `lint:md` / `build`
- [x] 4.2 `openspec validate --strict`
