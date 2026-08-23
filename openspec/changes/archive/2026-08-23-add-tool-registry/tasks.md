## 1. Tool 接口

- [x] 1.1 定义 `Tool` 接口（name / description / inputSchema / execute）
- [x] 1.2 明确 `inputSchema` 为 Zod 类型、`execute` 为异步签名

## 2. ToolRegistry

- [x] 2.1 实现 `register` / `get` / `has` / `list`
- [x] 2.2 实现 `execute(name, argsJson)`：JSON.parse + inputSchema.parse 校验 + 调用 execute
- [x] 2.3 实现校验失败 / 非法 JSON 的报错（含工具名与原因）

## 3. Zod → JSON Schema 转换

- [x] 3.1 实现 `toToolDefinition(tool)`（用 Zod 4 内置 toJSONSchema 生成 parameters）
- [x] 3.2 实现 `toToolDefinitions()`（批量转换）

## 4. 导出

- [x] 4.1 在 `packages/core/src/index.ts` 导出 tools 模块的公共类型与 ToolRegistry

## 5. 测试

- [x] 5.1 Tool 注册 / 查询 / 重名行为测试
- [x] 5.2 工具执行（合法参数 / 非法参数 / 非法 JSON）测试
- [x] 5.3 Zod → JSON Schema 转换测试（断言 parameters 结构）
- [x] 5.4 校验失败错误信息测试
