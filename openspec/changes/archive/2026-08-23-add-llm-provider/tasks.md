## 1. 类型定义

- [x] 1.1 定义 `ChatRole` / `ChatMessage` / `ToolCall` 归一化类型
- [x] 1.2 定义 `ToolDefinition` / `ChatCompletionParams` / `TokenUsage` / `ChatCompletionResult` 类型
- [x] 1.3 定义 `LLMProvider` 接口（含 `name` 与 `chatCompletion`）

## 2. Provider 工厂

- [x] 2.1 定义 `ProviderFactory` 类型与内置工厂映射表
- [x] 2.2 实现 `createProvider`（openai-compatible / anthropic 分派 + custom 走 openai-compatible）

## 3. OpenAI 兼容实现

- [x] 3.1 实现 `createOpenAIProvider`：初始化 client、默认 DeepSeek baseURL
- [x] 3.2 实现密钥读取（DEEPSEEK_API_KEY 回退 OPENAI_API_KEY）与缺失报错
- [x] 3.3 实现消息 → OpenAI 格式适配（system/user/assistant/tool 四类角色）
- [x] 3.4 实现工具定义 → OpenAI 格式适配
- [x] 3.5 实现 OpenAI 响应 → ChatCompletionResult 归一化（含 tool_calls）

## 4. Anthropic 实现

- [x] 4.1 实现 `createAnthropicProvider`：初始化 client、密钥读取（ANTHROPIC_API_KEY）与缺失报错
- [x] 4.2 实现消息/工具 → Anthropic 格式适配（含 tool_result 回填）
- [x] 4.3 实现 Anthropic 响应（含 tool_use block）→ ChatCompletionResult 归一化

## 5. 导出

- [x] 5.1 在 `packages/core/src/index.ts` 导出 llm 模块的公共类型与工厂

## 6. 测试

- [x] 6.1 mock openai SDK：验证默认 baseURL、消息/工具适配、响应归一化
- [x] 6.2 mock anthropic SDK：验证 tool_use 归一化
- [x] 6.3 `createProvider` 分派测试（openai-compatible / anthropic / custom）
- [x] 6.4 密钥缺失报错测试（三种 provider）
