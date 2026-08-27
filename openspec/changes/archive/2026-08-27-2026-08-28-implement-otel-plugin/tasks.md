## 1. otel 落地

- [x] 1.1 `createOtelPlugin(options?)` + `createOtelHook`（10 点 span + 异常记录）
- [x] 1.2 `tests/otel.test.ts`（install 注册 hook + no-op tracer 安全）

## 2. core 注释清理

- [x] 2.1 `plugins/types.ts` registerRetriever「缺省 BM25」→ no-op `noopRetriever`
- [x] 2.2 `resolve/types.ts` retriever「默认 BM25」→ no-op `noopRetriever`

## 3. README

- [x] 3.1 plugin-otel README 状态改为「✅ 已实现」

## 4. 校验

- [x] 4.1 `pnpm test` / `typecheck` / `lint` / `spell` / `format:check` / `lint:md` / `build`
- [x] 4.2 `openspec validate --strict`
