## 1. todo 工具

- [x] 1.1 实现 `TodoStore`（add / list / update / delete，item = id/task/status）
- [x] 1.2 实现 `createTodoTool`（z.discriminatedUnion('action')，四种 action）

## 2. 文件工具

- [x] 2.1 实现 `resolveWithinRoot`（resolve + realpath 前缀校验）
- [x] 2.2 实现 `createReadFileTool`（根约束 + 大小截断）
- [x] 2.3 实现 `createWriteFileTool`（根约束 + maxFileBytes）

## 3. bash 工具

- [x] 3.1 实现策略校验（allowCommands 白名单 / denyPatterns 黑名单 / allowNetwork）
- [x] 3.2 实现 `createBashTool`（策略通过后走 SandboxBackend.exec）
- [x] 3.3 无沙箱时抛可读错误（不裸奔）

## 4. web_search 工具

- [x] 4.1 实现 domain 白/黑名单校验
- [x] 4.2 实现 `createWebSearchTool`（可注入 fetch + endpoint + 超时 + 截断）

## 5. 装配入口

- [x] 5.1 实现 `registerBuiltinTools(registry, security, deps)`（bash 仅 enabled 注册）
- [x] 5.2 在 `packages/core/src/index.ts` 导出内置工具与装配入口

## 6. 测试

- [x] 6.1 todo 状态流转测试
- [x] 6.2 文件路径约束（根内 / 根外 / `..` / symlink 逃逸）测试
- [x] 6.3 bash 策略（禁用 / 白名单 / 黑名单 / 无沙箱报错）测试（假沙箱）
- [x] 6.4 web_search domain 策略（放行 / 拒绝 / 截断）测试（假 fetch）
- [x] 6.5 registerBuiltinTools 装配（默认禁用 bash / enabled 注册）测试
