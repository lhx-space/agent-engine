## Context

用户提出「provider 数组 / 模型分组」——思考模型、执行模型、VLM 模型三类。经调研社区主流做法，结论是「按能力分字段，不按角色做扁平数组」。本 design 记录这一决策并落地第一步（`embedding` 能力分离）。

## 社区调研结论

- **OpenAI Agents SDK**：每个 agent 一个 `model`（`Agent(model=...)`），无「reasoning/execution」schema 拆分；reasoning 能力内嵌在模型里（o1/DeepSeek-R1）。
- **LlamaIndex**：`Settings.llm`（chat/completion）与 `Settings.embed_model`（embedding）**顶层分字段**，接口不同。
- **LangChain**：`ChatModel` 与 `Embeddings` 是**两个独立抽象**。
- **Swarms「Reasoning Duo」**：reasoner + executor 是**两个 agent 的编排模式**，不是配置 schema。

**共同点**：能力（chat / embedding / vision）是不同接口、不同协议，应**顶层分字段**；「思考 vs 执行」不是能力维度，而是成本/编排优化。

## Goals / Non-Goals

**Goals:**

- `embedding` 顶层配置字段 + `createEmbeddingProvider` 工厂 + `ResolvedAgent.embeddingProvider` 解析（插件注册优先，否则按配置）。
- 把「能力分离、不拆 reasoning、vision 外置」的决策写进 AGENTS.md §7.3。

**Non-Goals:**

- 不做「扁平 provider 数组」（角色字典会丢失接口差异，违背社区共识）。
- 不拆 `model.reasoning`/`model.execution`（`deepseek-reasoner` 单模型已含 think+execute；真需要时是编排层双 agent，不是配置字段）。
- 不做 `vision` 配置字段（多模态能力外置给自定义工具）。

## Decisions

### D1: 能力维度顶层分字段，不做扁平数组

**选择**：`model`（默认 chat/reasoning，向后兼容）与 `embedding`（独立 `EmbeddingProvider`）**顶层分开**；`vision` 不设字段。

**理由**：chat / embedding / vision 三种接口（文本→文本 / 文本→向量 / 多模态）协议不同，扁平数组无法表达「embedding 是不同接口」，会逼成「一个数组塞三种异构对象」。LlamaIndex/LangChain 均按能力分字段。

### D2: `embedding` 用独立 `EmbeddingConfigSchema`，经 `createEmbeddingProvider` 解析

**选择**：`EmbeddingConfigSchema = { provider, baseURL, apiKey?, model, dimension? }`；`createEmbeddingProvider(config)` 对 openai-compatible `/embeddings` 端点（POST `{ input: string[], model }` → `data[].embedding`）用 `FetchLike` 实现；`resolveAgentConfig` 里插件注册的 `EmbeddingProvider` 优先，否则按 `config.embedding` 解析。

**理由**：embedding 是独立能力，配置结构独立；openai-compatible embeddings 是事实标准（OpenAI/DeepSeek/ollama 均兼容），复用现有 `FetchLike` + `defaultFetch`，不自研 HTTP。

### D3: 不拆 reasoning/execution，不设 vision 字段

**选择**：`model` 保持单一（deepseek-chat 默认；deepseek-reasoner 已含 think+execute）；`vision` 外置。

**理由**：reasoning 拆分是成本/稳定性优化，非能力缺口；vision 多模态协议差异大、依赖多，先外置给工具，避免过早锁死 schema。二者记入 AGENTS.md §7.3 作为「明确不做」的边界。

## Risks / Trade-offs

- [不拆 reasoning] → 用户「思考/执行/VLM 三类模型」的直觉被收敛为「model + embedding + 外置 vision」；这是社区共识下的正确收敛，但需在回复里讲清理由。
- [embedding 无内置默认] → 未配 `embedding` 时 `ResolvedAgent.embeddingProvider` 为 undefined，语义召回优雅降级（与上一 change 一致）。
- [openai-compatible embeddings 假设] → 覆盖 OpenAI/DeepSeek/ollama；非兼容端点由用户经插件注入自定义 `EmbeddingProvider`。

## Migration Plan

- `embedding` 为可选新增字段，向后兼容；未配置时行为不变。
- 自建/第三方 embedding 服务：配置 `embedding.baseURL` + `model`，或经插件 `registerEmbeddingProvider` 注入自定义实现。
