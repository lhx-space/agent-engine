## 1. Hook 接口

- [x] 1.1 定义 `Hook` 接口（name + 六个循环内钩子点方法）
- [x] 1.2 明确可改写类方法的 `T | void` 返回类型
- [x] 1.3 明确观察类方法（onStepEnd / onError）的 void 返回

## 2. HookPipeline

- [x] 2.1 实现 `register`（注册 hook）
- [x] 2.2 实现各钩子点的链式执行（顺序 + 返回值传递）
- [x] 2.3 实现 `void` 保持原值的语义

## 3. Agent Loop 集成

- [x] 3.1 将 `AgentHooks` 替换为 `HookPipeline`
- [x] 3.2 在循环内接入 beforeLLM / afterLLM / beforeToolCall / afterToolCall / onStepEnd
- [x] 3.3 实现 hook 抛错触发 onError 后向上抛
- [x] 3.4 删除旧的 `AgentHooks` 接口

## 4. 导出

- [x] 4.1 在 `packages/core/src/index.ts` 导出 Hook / HookPipeline

## 5. 测试

- [x] 5.1 多 hook 链式执行测试
- [x] 5.2 可改写（返回新值）与保持（返回 void）测试
- [x] 5.3 Agent Loop 钩子点触发顺序测试
- [x] 5.4 hook 抛错触发 onError 并向上抛测试
- [x] 5.5 无阻断语义（接口类型）测试
