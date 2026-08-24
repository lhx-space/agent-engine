## 1. 入参规范化（崩溃修复）

- [x] 1.1 `tools/registry.ts`：`execute` 空/非法 JSON 入参兜底为 `{}`
- [x] 1.2 `agent/loop.ts`：执行工具前规范化 `arguments` 并写回 `toolCall`（历史同步）

## 2. 内置工具恒全注册（语义修复）

- [x] 2.1 `tools/builtin/index.ts`：移除 `want()` 过滤，内置工具恒全注册
- [x] 2.2 `agent/assemble.ts`：不再传 `tools` 过滤参数
- [x] 2.3 `config` 注释：`tools` 语义改为「额外工具引用」

## 3. demo 默认可用

- [x] 3.1 `apps/web/src/App.tsx`：默认 `files.roots` 补一个工作目录

## 4. 测试

- [x] 4.1 更新 `builtin-tools.test.ts`：移除过滤用例，改断言恒全注册
- [x] 4.2 新增空参数兜底测试（registry + loop 层）
- [x] 4.3 全量测试 + typecheck + build + lint/spell
