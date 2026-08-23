## 1. utils 拆分

- [x] 1.1 建 `tools/utils/`，移 http / search / path / domain / html / todo-store / bash-policy
- [x] 1.2 `builtin/` 各 tool 改从 `../utils/` 导入

## 2. 新工具

- [x] 2.1 calculator（expr-eval）
- [x] 2.2 datetime（Date/Intl）
- [x] 2.3 json（parse/stringify）
- [x] 2.4 base64（Buffer）
- [x] 2.5 sitesearch（SearchProvider + site）

## 3. 装配与导出

- [x] 3.1 `registerBuiltinTools` 注册 5 个新工具（受 tools 过滤）
- [x] 3.2 `types.ts` / `index.ts` 导出新类型与工厂
- [x] 3.3 SearchProvider 增 `site` 过滤，DuckDuckGo 拼 site: 语法

## 4. 测试

- [x] 4.1 calculator / datetime / json / base64 测试
- [x] 4.2 sitesearch（site 过滤传给 provider）测试
- [x] 4.3 registerBuiltinTools 含新工具测试
