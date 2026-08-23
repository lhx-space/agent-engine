## Context

`core` 包当前是占位实现。本 change 引入 LLM Provider 层，是 Agent Loop 的前置依赖。技术栈已定：`openai`（v7）+ `@anthropic-ai/sdk`（v0.120），默认 DeepSeek（OpenAI 兼容）。

`ModelConfig`（来自 `@agent-engine/config`）已定义 `provider`（openai-compatible / anthropic / custom）、`baseURL`、`model`、`temperature`、`maxTokens`。注意：**不含 apiKey**——密钥从环境变量读取。

## Goals / Non-Goals

**Goals:**

- 定义 SDK 无关的 `LLMProvider` 抽象与消息/工具归一化类型。
- 实现 openai-compatible（默认 DeepSeek）与 anthropic 两个 Provider。
- 支持 tool call（Agent Loop 必需）。
- 密钥从环境变量读取，缺失时抛出可读错误。

**Non-Goals:**

- 不实现 streaming（流式）——首版非流式，接口预留可选方法，M4 服务化时再实现。
- 不实现重试 / 退避（retry/backoff）——留待后续 change。
- 不实现 Provider 插件注册表——首版用工厂函数 + 内置实现即可。

## Decisions

### D1: 官方 SDK 而非裸 fetch

**选择**：使用官方 SDK（`openai` + `@anthropic-ai/sdk`）。

**理由**：符合「复用优先」纪律；SDK 已处理认证、流式、错误码、类型定义等底层细节。

**备选**：裸 `fetch` 直连 HTTP API。优点是无额外依赖、完全可控；缺点是需自己处理 SSE 流式、重试、错误码映射，且违背「复用优先」纪律。**否决**。

### D2: 抽象层类型归一化

**选择**：自研 `ChatMessage` / `ToolCall` / `ToolDefinition` 类型，Provider 实现内部做 SDK 适配。

**理由**：内核（Agent Loop）只面向自研类型，不泄漏 SDK 类型，切换供应商零改动。这是「内核自研 + SDK 复用」边界的具体落地。

**备选**：直接透传 SDK 类型（如 `OpenAI.ChatCompletionMessageParam`）。缺点：Agent Loop 与 SDK 强耦合，换供应商要改执行循环。**否决**。

### D3: custom provider 的协议假设

**选择**：`custom` 走 OpenAI 兼容实现，但 `baseURL` 必填。

**理由**：OpenAI 兼容是事实标准（DeepSeek / Ollama / vLLM / 本地模型均如此），无需单独协议分支。

**备选**：custom 抛「未实现」错误。缺点：无法对接本地模型，违背「本地推理后期可选接入」的目标。**否决**。

### D4: API Key 从环境变量读取

**选择**：`openai-compatible` 读 `DEEPSEEK_API_KEY`（回退 `OPENAI_API_KEY`）；`anthropic` 读 `ANTHROPIC_API_KEY`。

**理由**：密钥不入配置文件（配置会进 git / 被共享 / 被 web 平台展示），是安全最佳实践。

### D5: 首版非流式

**选择**：`LLMProvider` 只定义 `chatCompletion`；`streamChatCompletion` 作为可选方法预留。

**理由**：Agent Loop 首版用非流式即可闭环；流式复杂度高（SSE、增量 token 组装、跨 SDK 差异），留待 M4 服务化再上，避免过早引入复杂度。

## Risks / Trade-offs

- [openai SDK v7 的类型 / 签名变化] → 以 `pnpm typecheck` 为准适配 v7 的 `chat.completions.create` 签名；测试用 mock 隔离真实网络。
- [Anthropic SDK 的 tool_use block 格式差异] → Provider 内部把 `tool_use` 归一化为 `ToolCall`，用单测覆盖 tool_use → toolCalls 的映射。
- [apiKey 缺失时报错不友好] → 工厂在创建 Provider 时即检测环境变量，缺失则抛出明确错误（提示应设置的变量名）。
- [baseURL 与 DeepSeek 的版本路径差异] → DeepSeek 兼容 OpenAI 的 `/v1` 路径约定，`baseURL` 缺省时用 `https://api.deepseek.com`（SDK 自动补全 `/v1`）。

## Migration Plan

无迁移。core 包当前为占位实现，直接新增 `llm/` 模块并导出，`src/index.ts` 补充导出。

## Open Questions

- 无（streaming、重试、Provider 注册表已在 Non-Goals 明确留待后续）。
