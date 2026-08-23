## Why

M1 阶段，`core` 包需要一个统一的 LLM 接入层——否则后续的 Agent Loop（ReAct 循环）无法调用模型。当前 `core` 包仍是占位实现（仅导出 name/version）。

本项目默认使用 DeepSeek（OpenAI 兼容 API），同时要支持 Anthropic 与未来的本地模型（ollama / vLLM）。如果 Agent Loop 直接依赖 `openai` 或 `@anthropic-ai/sdk` 的原始类型，会导致两个问题：

1. **内核与具体 SDK 强耦合**：切换模型供应商需要改动执行循环代码，违背「可插拔 Provider」的设计理念。
2. **两套 SDK 格式不一致**：OpenAI 与 Anthropic 的消息结构、工具调用格式差异很大，Agent Loop 若直接面对两套类型需要分别适配，复杂度翻倍。

因此需要定义一个与 SDK 无关的 `LLMProvider` 抽象，以及 `ChatMessage` / `ToolCall` / `ToolDefinition` 归一化类型，把底层差异收敛到 Provider 实现内部。

## What Changes

- 定义 LLM 领域归一化类型：`ChatMessage`、`ToolCall`、`ToolDefinition`、`ChatCompletionParams`、`ChatCompletionResult`、`TokenUsage`。
- 定义 `LLMProvider` 抽象接口（`chatCompletion` 方法）。
- 实现 `createProvider(config)` 工厂：按 `ModelConfig.provider` 分派到对应实现。
- 实现 **OpenAI 兼容 Provider**：默认 DeepSeek（`baseURL` 缺省为 `https://api.deepseek.com`）。
- 实现 **Anthropic Provider**。
- `custom` provider 走 OpenAI 兼容实现（自定义端点通常为 OpenAI 兼容协议），但 `baseURL` 必填。
- API Key 一律从环境变量读取（**不进配置文件**，安全考虑）。
- 支持 tool call（Agent Loop 的硬依赖）。

## Capabilities

### New Capabilities

- `llm-provider`: 与 SDK 无关的 LLM Provider 抽象、OpenAI 兼容实现（默认 DeepSeek）、Anthropic 实现、Provider 工厂、消息与工具的归一化。

### Modified Capabilities

<!-- 无：agent-config-schema 的 requirement 不变，本 change 仅消费其 ModelConfig 类型 -->

## Impact

- 新增 `packages/core/src/llm/`（types / provider 工厂 / openai-compatible / anthropic 实现）。
- 依赖：`openai`（v7）、`@anthropic-ai/sdk`（v0.120），已在 `@agent-engine/core` 的 dependencies 声明。
- 新增 `packages/core/tests/` 下的单元测试（mock 两个 SDK，验证归一化与工厂分派）。
- 复用 `@agent-engine/config` 的 `ModelConfig` 类型。
- 无 breaking changes（core 包当前为占位实现）。
