## 1. 类型与接口

- [x] 1.1 定义 `GuardrailContext`（toolName / args / result 可选字段）
- [x] 1.2 定义 `GuardrailResult`（allowed / reason）
- [x] 1.3 定义 `GuardrailRule` 接口（id / on / validate）

## 2. RuleRegistry

- [x] 2.1 实现 `register` / `get` / `list`
- [x] 2.2 实现 `forPoint(point)`（按触发节点过滤）

## 3. Agent Loop 集成

- [x] 3.1 在 beforeToolCall 节点执行匹配的 guardrail
- [x] 3.2 阻断时回填 `Blocked: <reason>` 且不执行工具
- [x] 3.3 在 afterToolCall 节点执行匹配的 guardrail
- [x] 3.4 afterToolCall 阻断时替换结果

## 4. 导出

- [x] 4.1 在 `packages/core/src/index.ts` 导出 GuardrailRule / RuleRegistry 及类型

## 5. 测试

- [x] 5.1 RuleRegistry 注册 / 查询 / forPoint 测试
- [x] 5.2 beforeToolCall 阻断测试（工具不执行、回填 Blocked）
- [x] 5.3 beforeToolCall 放行测试
- [x] 5.4 阻断后循环继续测试
- [x] 5.5 afterToolCall guardrail 测试
