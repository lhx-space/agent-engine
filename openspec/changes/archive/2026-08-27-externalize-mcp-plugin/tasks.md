## 1. core 新增 ToolSource 协议

- [x] 1.1 `ToolSource` 接口 + `registerToolSource` + `CapabilityBundle.toolSources`
- [x] 1.2 `assemble` resolve ToolSource + 聚合 dispose
- [x] 1.3 `mcp.connected` / `mcp.failed` 事件删除

## 2. 新增 plugin-mcp 包

- [x] 2.1 `package.json` / `tsconfig.json` / `tsdown.config.ts`
- [x] 2.2 `src/{index,client,normalize,types,mcp}.ts`
- [x] 2.3 `README.md` / `README.zh-cn.md`

## 3. core 删除 MCP

- [x] 3.1 删 `mcp/` 目录、`capability-source/mcp.ts`
- [x] 3.2 `resolve` / `index.ts` / `types.ts` / `tsdown.config.ts` / `package.json` 同步

## 4. 测试迁移

- [x] 4.1 新增 `plugin-mcp/tests/mcp.test.ts`
- [x] 4.2 迁移 core 的 mcp / capability-source 测试

## 5. 校验

- [x] 5.1 `pnpm test` / `typecheck` / `lint` / `spell` / `format:check` / `lint:md` / `build`
- [x] 5.2 `openspec validate --strict`
