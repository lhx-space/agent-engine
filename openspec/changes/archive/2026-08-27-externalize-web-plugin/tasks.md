## 1. 新增 plugin-web 包

- [x] 1.1 `package.json` / `tsconfig.json` / `tsdown.config.ts`
- [x] 1.2 `src/{index,web-search,web-fetch,search,duckduckgo,searxng,serper,tavily,domain,html}.ts`
- [x] 1.3 `README.md` / `README.zh-cn.md`

## 2. core 删除 web

- [x] 2.1 删 `tools/builtin/{web-search,web-fetch}.ts` 与 `tools/utils/{search,duckduckgo,searxng,serper,tavily,domain,html}.ts`
- [x] 2.2 `registerBuiltinTools` 只注册 todo/datetime，签名移除 security
- [x] 2.3 `assemble` / `index.ts` / `types.ts` 同步

## 3. 测试迁移

- [x] 3.1 新增 `plugin-web/tests/web.test.ts`
- [x] 3.2 迁移 core 的 builtin-tools web 用例

## 4. 校验

- [x] 4.1 `pnpm test` / `typecheck` / `lint` / `spell` / `format:check` / `lint:md` / `build`
- [x] 4.2 `openspec validate --strict`
