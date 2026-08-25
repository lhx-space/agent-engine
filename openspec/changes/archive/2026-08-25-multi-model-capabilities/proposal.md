## Why

用户提出「provider 数组 / 模型分组」：希望一个 Agent 能声明「思考模型 + 执行模型 + VLM 模型」三类。对照社区主流做法（OpenAI Agents SDK 每 agent 单 model、LlamaIndex `Settings.llm`/`embed_model` 顶层能力分字段、LangChain 分离 `ChatModel`/`Embeddings`、Swarms 的 reasoning+executor 是**编排模式**而非 schema），结论是：**按能力分字段，不按角色做扁平数组**——因为 chat / embedding / vision 是三种不同接口与协议，塞进一个数组会丢失类型差异。本 change 落地「能力分离」的第一步：独立的 `embedding` 配置字段 + `EmbeddingProvider` 解析（承接上一 change 已立好的接口）。

## What Changes

- `config` 新增 `EmbeddingConfigSchema`（`provider` / `baseURL` / `apiKey` / `model` / `dimension?`）与 `AgentConfig.embedding`（可选）。
- `core` 新增 `createEmbeddingProvider(config)` 工厂（openai-compatible `/embeddings` 端点，复用 `FetchLike`）；`resolveAgentConfig` 当配置 `embedding` 时解析出 `EmbeddingProvider`，随 `ResolvedAgent.embeddingProvider` 暴露（插件注册的优先）。
- **决策文档**：`model` 不拆 reasoning/execution（`deepseek-reasoner` 单模型已含 think+execute，拆分是成本优化，留未来编排层）；`vision` 不设配置字段（能力外置，交给自定义工具）。

## Capabilities

### Modified Capabilities

- `agent-config-schema`: 新增 `embedding` 配置。
- `llm-provider`: 新增 `createEmbeddingProvider` 工厂 + `EmbeddingConfig` 解析。

## Impact

- `packages/config/src/schema/index.ts`：`EmbeddingConfigSchema` + `AgentConfig.embedding`。
- `packages/core/src/embedding/{openai.ts,index.ts}`：`createEmbeddingProvider`。
- `packages/core/src/resolve/resolve.ts` + `agent/assemble.ts`：`embedding` 解析接线（插件注册优先，否则按配置）。
- `apps/web/src/config/ModelForm.tsx`：新增 embedding 配置段（后续 UI）。
- 测试：schema（embedding 默认/显式）+ embedding provider（openai 兼容端点 mock）。
- **非破坏**：`embedding` 可选新增字段；不拆 `model`、不加 `vision` 字段。
