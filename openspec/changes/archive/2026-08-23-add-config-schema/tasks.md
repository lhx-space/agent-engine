## 1. Schema

- [x] 1.1 定义 model / systemPrompt 子 Schema
- [x] 1.2 定义 rules / tools / mcp / skills 子 Schema
- [x] 1.3 定义 memory / hooks / plugins / orchestration 子 Schema
- [x] 1.4 组合为 AgentConfigSchema 并导出 z.infer 类型

## 2. Loader

- [x] 2.1 实现扩展名判定与 yaml 解析
- [x] 2.2 实现 json5 解析
- [x] 2.3 实现 jiti 加载 TypeScript 配置
- [x] 2.4 实现 loadAgentConfig 统一入口（解析 + Zod 校验 + 错误包装）

## 3. 测试

- [x] 3.1 契约测试：三格式产出等价 AgentConfig
- [x] 3.2 校验失败场景测试
- [x] 3.3 默认值（provider=openai-compatible）测试
