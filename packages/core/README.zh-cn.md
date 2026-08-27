# @agent-engine/core

Agent 内核执行引擎（瘦内核）：LLM Provider 抽象、Tool 注册表、单 Agent ReAct 循环、hooks / guardrails 协议、可插拔的记忆 / 检索 / embedding / 缓存后端、插件系统、执行沙箱与事件总线。

> **能力在 `@agent-engine/plugin-*`，不在 core。** 内核只保留「**引擎 + 协议**」（`LLMProvider` / `Retriever` / `hybridRetrieve` / `ToolSource` / `ContextContributor` / `GuardrailRule` / `LongTermMemory` / 各后端）。rules / skills / documents / 语义记忆 / web / mcp / 声明式 guardrail 编译均已外放——见[能力对照表](#能力对照表)。

**设计铁律**：每个扩展点都是「**接口 + in-memory 默认 + 注入点**」（`PluginContext.register*` + `CapabilityBundle` + `ResolvedAgent`）。具体后端（pgvector / redis / embedding 模型 / 缓存）由用户或生态接入，内核只做适配。

## 安装

```bash
pnpm add @agent-engine/core @agent-engine/config
```

## 端到端

```ts
import { loadAgentConfig } from '@agent-engine/config';
import { createProvider, resolveAgentConfig } from '@agent-engine/core';

const config = await loadAgentConfig('agent.yaml'); // YAML/JSON5/TS → AgentConfig
const resolved = await resolveAgentConfig(config, {
  providerFactory: (model) =>
    createProvider({ ...model, apiKey: model.apiKey ?? process.env.DEEPSEEK_API_KEY }),
});

const result = await resolved.agent.run('帮我部署到生产');
console.log(result.finalMessage.content);
await resolved.dispose(); // 释放工具来源（如 MCP 连接）
```

`agent.yaml`：

```yaml
name: hello-agent
model:
  provider: openai-compatible
  baseURL: https://api.deepseek.com/v1
  model: deepseek-chat
  # 采样参数（均可选；配置为缺省值，单次调用可覆盖）
  temperature: 0.2
  topP: 0.9
  seed: 42
systemPrompt: { template: 你是一个简洁、可靠的助手。 }
```

> 下面的「配方」展示**如何直接使用每一块**（绕开配置轴），让你不经过配置层也能扩展内核。

## 配方（Recipes）

### 1. LLM Provider

实现接口（自定义协议），或用内置工厂。

```ts
import { createOpenAIProvider, createAnthropicProvider, createProvider } from '@agent-engine/core';
import type { LLMProvider } from '@agent-engine/core';

// 内置：DeepSeek / OpenAI 兼容
const openai = createOpenAIProvider({ model: 'deepseek-chat', apiKey: 'sk-...' });

// 内置：Anthropic
const anthropic = createAnthropicProvider({ model: 'claude-sonnet-4-5', apiKey: 'sk-ant-...' });

// 按 provider 名分发
const provider: LLMProvider = createProvider({ provider: 'anthropic', model: 'claude-sonnet-4-5' });

// 自定义 provider（任意协议）
const custom: LLMProvider = {
  name: 'my-model',
  async chatCompletion(params) {
    return { message: { role: 'assistant', content: 'ok' } };
  },
};

const result = await provider.chatCompletion({ messages: [{ role: 'user', content: 'hi' }] });
```

**采样参数**跨 provider 归一化为「配置缺省 + 调用覆盖」（`params.X ?? config.X`）：`temperature`、`maxTokens`、`topP`、`frequencyPenalty`、`presencePenalty`、`stop`、`seed`。每个 provider 只透传其协议支持的字段（anthropic 忽略 `frequencyPenalty` / `presencePenalty` / `seed`）。

### 2. 工具

注册自定义工具；`inputSchema` 用 Zod（运行时校验 + 转 JSON Schema 给 LLM）。

```ts
import { z } from 'zod';
import { ToolRegistry } from '@agent-engine/core';

const registry = new ToolRegistry();
registry.register({
  name: 'calculator',
  description: '计算算术表达式',
  inputSchema: z.object({ expression: z.string() }),
  async execute({ expression }) {
    return { value: eval(expression) }; // 仅演示——绝不要 eval 不可信输入
  },
});

await registry.execute('calculator', JSON.stringify({ expression: '1 + 1' }));
const definitions = registry.toToolDefinitions(); // → LLM 工具定义
```

- `registerBuiltinTools(registry, deps?)` 只注册**通用原语** `builtin.todo` / `builtin.datetime`。
- `createReadFileTool` / `createWriteFileTool` / `createListFilesTool` / `createBashTool` 工厂在 `core/tools`，但**装配它们的插件**是 `@agent-engine/plugin-files` / `@agent-engine/plugin-bash`。
- `web_search` / `web_fetch` 已迁出到 `@agent-engine/plugin-web`。

### 3. AgentLoop 运行选项

`agent.run(userInput, options?)` 支持流式、事件、Human-in-the-loop 审批与取消。

```ts
import { AbortError } from '@agent-engine/core';

const result = await resolved.agent.run('给我写个脚本', {
  signal: controller.signal,
  onEvent: (event) => {
    if (event.type === 'llm_delta') process.stdout.write(event.delta);
    if (event.type === 'tool_call') console.log('调用', event.name, event.args);
    if (event.type === 'done') console.log('\n步数:', event.steps);
  },
  approveToolCall: async (name, args) => ({
    approved: name !== 'bash' || args.includes('kubectl'),
    reason: 'bash 命令需人工确认',
  }),
});
// 取消：controller.abort() → 抛 AbortError（不回写记忆）
```

### 4. Hooks

Hook 在 10 个生命周期点观察 / 改写，从不阻断（阻断是 guardrail 的职责）。

```ts
import { HookPipeline } from '@agent-engine/core';
import type { Hook } from '@agent-engine/core';

const audit: Hook = {
  name: 'audit',
  async beforeLLM(messages) {
    console.log('prompt 大小 ~', JSON.stringify(messages).length);
  },
  async afterToolCall(name, result) {
    console.log('工具', name, '→', result.slice(0, 120));
  },
};

const hooks = new HookPipeline();
hooks.register(audit);
hooks.onTrace((trace) => console.log(trace)); // 哪个 hook、耗时、是否改写
```

### 5. Guardrails（协议）

内核只定义可执行 `GuardrailRule` 协议（`validate({ toolName, args?, result? }) → { allowed, reason }`），并经 `PluginContext.registerGuardrail` 注入规则。**把声明式 `config.guardrails` 编译成规则**在 `@agent-engine/plugin-guardrails`。

```ts
import type { GuardrailRule } from '@agent-engine/core';

const denyRm: GuardrailRule = {
  on: 'beforeToolCall',
  async validate({ toolName, args }) {
    if (toolName === 'bash' && /rm -rf/.test(args ?? '')) {
      return { allowed: false, reason: 'rm -rf 被禁止' };
    }
    return { allowed: true };
  },
};
```

### 6. 上下文组装与统一缝

```ts
import {
  buildSystemPrompt,
  renderTemplate,
  TokenBudgetCompactor,
  ApproximateTokenCounter,
} from '@agent-engine/core';
import type { ContextContributor } from '@agent-engine/core';

// renderTemplate / buildSystemPrompt 现在只渲染用户变量——
// rules/skills/documents 经 ContextContributor（文本 + run 级工具）注入，不再走模板占位符。
const rendered = renderTemplate('你是 {{role}}', { role: 'SRE' });
const prompt = buildSystemPrompt({ systemPrompt: { template: '你是 SRE。', variables: {} } });

// ContextContributor 是能力向 prompt 与工具注册表注入的统一缝
const contributor: ContextContributor = {
  name: 'my-notes',
  async contribute({ userInput }) {
    return { text: `[笔记] 关于「${userInput}」的补充说明` };
  },
};

const compactor = new TokenBudgetCompactor(new ApproximateTokenCounter());
const kept = await compactor.compact(messages, 4000); // 按整轮淘汰，控制在预算内
```

### 7. 记忆

```ts
import {
  ConversationMemory,
  InMemoryMemoryBackend,
  LLMSummarizer,
  noopLongTermMemory,
} from '@agent-engine/core';

// ① 条数裁剪 / ② token 预算 + 滚动摘要
const memory = new ConversationMemory({
  maxMessages: 50,
  compactor: new TokenBudgetCompactor(new ApproximateTokenCounter()),
  budgetTokens: 8000,
  summarizer: new LLMSummarizer(provider),
});
memory.append([
  { role: 'user', content: '...' },
  { role: 'assistant', content: '...' },
]);
const window = await memory.getWindow();

// ③ 长期记忆在这里是协议；语义实现（SemanticMemory）在 @agent-engine/plugin-memory，
//    经 ResolveDeps.longTermMemoryFactory 注入。
const longTerm = noopLongTermMemory; // core 默认
```

### 8. 检索（协议 + 混合编排）

```ts
import {
  hybridRetrieve,
  reciprocalRankFusion,
  InMemoryVectorStore,
  noopRetriever,
} from '@agent-engine/core';

// 每个能力插件自建索引（MiniSearch 词法 + 可选 InMemoryVectorStore），
// 并复用 hybridRetrieve 作为唯一的 BM25 + 向量 RRF 编排器：
const hits = await hybridRetrieve('帮我写个组件', 5, {
  lexical: (query, topK) => lexicalIndex.search(query, topK), // 你的 BM25 实现
  embedding: embeddingProvider,
  vectorStore,
  ensureVectors: async (ids) => embeddingProvider.embed(await textsFor(ids)),
});

// 原始 RRF：融合多路排名，无需对齐分数尺度
const fused = reciprocalRankFusion([
  [
    { id: 'a', score: 9 },
    { id: 'b', score: 5 },
  ],
  [{ id: 'b', score: 9 }],
]);
```

### 9. Embedding

```ts
import { createEmbeddingProvider } from '@agent-engine/core';

const embedding = createEmbeddingProvider({
  baseURL: 'https://api.openai.com/v1',
  model: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY,
});
const [vector] = await embedding.embed(['hello world']);
console.log(embedding.dimension, vector.length);
```

### 10. 插件

插件打包「tools + 工具来源 + hooks + guardrails + prompt 片段 + context 贡献者 + 各后端」，经 `PluginContext` 一次性注入。

```ts
import { PluginManager } from '@agent-engine/core';
import type { Plugin } from '@agent-engine/core';

const plugin: Plugin = {
  name: 'my-plugin',
  description: '示例插件',
  version: '1.0.0',
  install(ctx) {
    ctx.registerTool({
      name: 'hello',
      description: 'say hi',
      inputSchema: z.object({}),
      execute: async () => ({ hi: true }),
    });
    ctx.registerHook({ name: 'p-hook', async onInit() {} });
    ctx.registerContextContributor({
      name: 'p-note',
      async contribute() {
        return { text: '本插件已加载。' };
      },
    });
    ctx.provideSystemPrompt('本插件已加载。');
  },
};

const manager = new PluginManager();
await manager.install(plugin);
const bundle = manager.getAssembly(); // CapabilityBundle
```

### 11. 工具来源（MCP 协议）

内核只定义 `ToolSource { name; resolve() → { tools, dispose } }`；MCP client（`connectMcpServer` / `connectMcpServers`）已迁出到 `@agent-engine/plugin-mcp`。

```ts
import type { ToolSource } from '@agent-engine/core';

const source: ToolSource = {
  name: 'external',
  async resolve() {
    return { tools: [/* 归一化后的 Tool[] */], dispose: async () => {} };
  },
};
```

### 12. 沙箱

```ts
import { resolveSandboxBackend, WasiFunctionSandbox } from '@agent-engine/core';

const resolution = resolveSandboxBackend('auto', {
  workspaceRoot: '/workspace',
  image: 'agent-engine/sandbox',
});
if (resolution.available) {
  const { exitCode, stdout, stderr } = await resolution.backend.exec({
    command: 'kubectl',
    args: ['get', 'pods'],
    network: 'none',
  });
}

const wasi = new WasiFunctionSandbox();
const out = await wasi.exec({ wasm: compiledWasmBytes, args: ['arg1'], timeoutMs: 2000 });
```

### 13. 事件总线

```ts
import { EventBus } from '@agent-engine/core';

const bus = new EventBus();
const off = bus.on((event) => console.log(event));
bus.emit({ type: 'tool.registered', name: 'calculator' });
off();
```

### 14. 结构化输出

```ts
import { z } from 'zod';
import { extractStructured } from '@agent-engine/core';

const schema = z.object({ severity: z.enum(['low', 'high']), summary: z.string() });
const parsed = await extractStructured({
  provider,
  schema,
  messages: [{ role: 'user', content: '这是一次事故报告：...' }],
});
```

### 15. 缓存

```ts
import { InMemoryCacheBackend } from '@agent-engine/core';

const cache = new InMemoryCacheBackend();
await cache.set('user:1', { plan: 'basic' }, 60_000); // TTL 60s
await cache.get('user:1'); // → { plan: 'basic' }
await cache.delete('user:1');
```

## 子路径导出

| 子路径                  | 模块       | 要点                                                                                                                                                                               |
| ----------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@agent-engine/core`    | —          | `AgentLoop`、`assembleAgentLoop`、`resolveAgentConfig`、各后端与类型                                                                                                               |
| `.../llm`               | LLM        | `createProvider` / `createOpenAIProvider` / `createAnthropicProvider`、`LLMProvider`、`FinishReason`、`CompletionError`、`AbortError`、采样参数                                    |
| `.../tools`             | Tools      | `Tool`、`ToolRegistry`、`registerBuiltinTools`（todo/datetime）、`create*FileTool`、`createBashTool`、utils（`defaultFetch`、`resolveWithinRoot`、`TodoStore`、`checkBashPolicy`） |
| `.../agent`             | Agent      | `AgentLoop`、`assembleAgentLoop`、`ToolApproval`（HITL）、`AgentRunOutcome`                                                                                                        |
| `.../hooks`             | Hooks      | `Hook`、`HookPipeline`、`HookPoint`、`HookTrace`                                                                                                                                   |
| `.../guardrails`        | Guardrails | `GuardrailRule`、`GuardrailContext`、`GuardrailResult`（仅协议）                                                                                                                   |
| `.../context`           | Context    | `ContextComposer`、`buildSystemPrompt`、`renderTemplate`、`ContextContributor`、`TokenCounter`、`ContextCompactor`                                                                 |
| `.../memory`            | Memory     | `ConversationMemory`、`MemoryBackend`、`Summarizer`、`LongTermMemory`、`noopLongTermMemory`、`LLMSummarizer`                                                                       |
| `.../retrieval`         | Retrieval  | `hybridRetrieve`、`Retriever`、`Reranker`、`IdentityReranker`、`noopRetriever`、`reciprocalRankFusion`、`InMemoryVectorStore`、`VectorStore`                                       |
| `.../embedding`         | Embedding  | `EmbeddingProvider`、`createEmbeddingProvider`                                                                                                                                     |
| `.../plugins`           | Plugins    | `Plugin`、`PluginContext`、`PluginManager`                                                                                                                                         |
| `.../capability`        | Capability | `CapabilityBundle`、`mergeBundles`                                                                                                                                                 |
| `.../capability-source` | Sources    | `ToolSource`                                                                                                                                                                       |
| `.../resolve`           | Resolve    | `resolveAgentConfig`（config → `ResolvedAgent`）                                                                                                                                   |
| `.../sandbox`           | Sandbox    | `SandboxBackend`（docker/nsjail）、`WasiFunctionSandbox`                                                                                                                           |
| `.../events`            | Events     | `EventBus`、`AgentEngineEvent`                                                                                                                                                     |
| `.../structured-output` | Structured | `extractStructured`（JSON 模式 + Zod + 重试）                                                                                                                                      |
| `.../cache`             | Cache      | `CacheBackend`、`InMemoryCacheBackend`                                                                                                                                             |

## 能力对照表

**曾经在 core**、现在住在能力插件里的东西（各自保留索引、复用 `hybridRetrieve` + `ContextContributor`）：

| 能力                               | 现在在哪                                        |
| ---------------------------------- | ----------------------------------------------- |
| rules（加载 + 检索 + 注入）        | `@agent-engine/plugin-rules`                    |
| skills（path/npm/git 加载 + 捆绑） | `@agent-engine/plugin-skills`                   |
| documents（归一化/分块/检索）      | `@agent-engine/plugin-documents`                |
| 语义长期记忆                       | `@agent-engine/plugin-memory`                   |
| `web_search` / `web_fetch`         | `@agent-engine/plugin-web`                      |
| MCP client（stdio）                | `@agent-engine/plugin-mcp`                      |
| 声明式 guardrail 编译              | `@agent-engine/plugin-guardrails`               |
| file / bash / git 工具套件         | `@agent-engine/plugin-files` / `-bash` / `-git` |
| OpenTelemetry 可观测               | `@agent-engine/plugin-otel`                     |
| 上述全部聚合                       | `@agent-engine/preset-default`                  |

## 设计说明

- **瘦内核**：内核保留引擎 + 协议；领域能力外放为 `plugin-*`。core 不读 `config.rules` / `config.skills` / `config.documents` / `config.mcp`——这些切片由插件解释。
- **内核自研 + SDK 复用**：loop / plugins / hooks / guardrails 协议自研；LLM / 向量复用官方 SDK。不引入 LangChain。
- **多模型边界**：`LLMProvider` 只覆盖 chat；embedding 是独立的 `EmbeddingProvider`。
- **hooks vs guardrails**：hooks 观察 / 改写；guardrails 阻断。

## 依赖

- `@agent-engine/config`（schema 类型）
- `openai` / `@anthropic-ai/sdk`（LLM SDK）
- `picomatch`（glob 匹配）、`zod`（运行时校验）
- dev：`wabt`（WASI 编译）

> 能力外放时从 core 移除：`minisearch`、`mammoth`、`epub2`、`turndown`、`unpdf`、`gray-matter`、`@mozilla/readability`、`linkedom`、`@modelcontextprotocol/sdk`——这些现归各自 `plugin-*` 包。

## 状态

✅ 已实现（M1–M3 瘦内核；多 Agent 编排延后到独立包）。
