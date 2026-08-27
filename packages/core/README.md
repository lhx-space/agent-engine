# @agent-engine/core

Agent kernel execution engine (thin kernel): LLM Provider abstraction, Tool registry, single-agent ReAct loop, hooks / guardrails protocol, pluggable memory / retrieval / embedding / cache backends, plugin system, execution sandbox and event bus.

> **Capabilities live in `@agent-engine/plugin-*`, not here.** The kernel only keeps the **engine + protocols** (`LLMProvider` / `Retriever` / `hybridRetrieve` / `ToolSource` / `ContextContributor` / `GuardrailRule` / `LongTermMemory` / backends). rules / skills / documents / semantic memory / web / mcp / declarative-guardrail compilation were externalized — see [Capability map](#capability-map).

**Design rule**: every extension point is an **interface + in-memory default + injection point** (`PluginContext.register*` + `CapabilityBundle` + `ResolvedAgent`). Concrete backends (pgvector / redis / embedding models / caches) are supplied by users or the ecosystem.

## Install

```bash
pnpm add @agent-engine/core @agent-engine/config
```

## End-to-end

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
await resolved.dispose(); // release tool sources (e.g. MCP connections)
```

`agent.yaml`:

```yaml
name: hello-agent
model:
  provider: openai-compatible
  baseURL: https://api.deepseek.com/v1
  model: deepseek-chat
  # sampling (all optional; config is the default, per-call params override)
  temperature: 0.2
  topP: 0.9
  seed: 42
systemPrompt: { template: 你是一个简洁、可靠的助手。 }
```

> The rest of this document shows **how to use each piece directly** (outside the config axis), so you can extend the kernel without the config layer.

## Recipes

### 1. LLM provider

Implement the interface (custom protocol), or use a built-in factory.

```ts
import { createOpenAIProvider, createAnthropicProvider, createProvider } from '@agent-engine/core';
import type { LLMProvider } from '@agent-engine/core';

// built-in: DeepSeek / OpenAI-compatible
const openai = createOpenAIProvider({ model: 'deepseek-chat', apiKey: 'sk-...' });

// built-in: Anthropic
const anthropic = createAnthropicProvider({ model: 'claude-sonnet-4-5', apiKey: 'sk-ant-...' });

// dispatch by provider name
const provider: LLMProvider = createProvider({ provider: 'anthropic', model: 'claude-sonnet-4-5' });

// custom provider (any protocol)
const custom: LLMProvider = {
  name: 'my-model',
  async chatCompletion(params) {
    return { message: { role: 'assistant', content: 'ok' } };
  },
};

const result = await provider.chatCompletion({ messages: [{ role: 'user', content: 'hi' }] });
```

**Sampling parameters** are normalized across providers as **config default + per-call override** (`params.X ?? config.X`): `temperature`, `maxTokens`, `topP`, `frequencyPenalty`, `presencePenalty`, `stop`, `seed`. Each provider only forwards what its protocol supports (Anthropic ignores `frequencyPenalty` / `presencePenalty` / `seed`).

### 2. Tools

Register a custom tool; `inputSchema` is Zod (validated at runtime + converted to JSON Schema for the LLM).

```ts
import { z } from 'zod';
import { ToolRegistry } from '@agent-engine/core';

const registry = new ToolRegistry();
registry.register({
  name: 'calculator',
  description: 'Evaluate an arithmetic expression',
  inputSchema: z.object({ expression: z.string() }),
  async execute({ expression }) {
    return { value: eval(expression) }; // demo only — never eval untrusted input
  },
});

await registry.execute('calculator', JSON.stringify({ expression: '1 + 1' }));
const definitions = registry.toToolDefinitions(); // → LLM tool definitions
```

- `registerBuiltinTools(registry, deps?)` registers only the **general primitives** `builtin.todo` / `builtin.datetime`.
- `createReadFileTool` / `createWriteFileTool` / `createListFilesTool` / `createBashTool` factories live in `core/tools`, but the **plugins** that assemble them are `@agent-engine/plugin-files` / `@agent-engine/plugin-bash`.
- `web_search` / `web_fetch` moved to `@agent-engine/plugin-web`.

### 3. Agent loop runtime options

`agent.run(userInput, options?)` supports streaming, events, Human-in-the-loop approval and cancellation.

```ts
import { AbortError } from '@agent-engine/core';

const result = await resolved.agent.run('给我写个脚本', {
  signal: controller.signal,
  onEvent: (event) => {
    if (event.type === 'llm_delta') process.stdout.write(event.delta);
    if (event.type === 'tool_call') console.log('calling', event.name, event.args);
    if (event.type === 'done') console.log('\nsteps:', event.steps);
  },
  approveToolCall: async (name, args) => ({
    approved: name !== 'bash' || args.includes('kubectl'),
    reason: 'bash 命令需人工确认',
  }),
});
// cancellation: controller.abort() → throws AbortError (does not write back memory)
```

### 4. Hooks

Hooks observe/rewrite at 10 lifecycle points; they never block (blocking is guardrails' job).

```ts
import { HookPipeline } from '@agent-engine/core';
import type { Hook } from '@agent-engine/core';

const audit: Hook = {
  name: 'audit',
  async beforeLLM(messages) {
    console.log('prompt tokens ~', JSON.stringify(messages).length);
  },
  async afterToolCall(name, result) {
    console.log('tool', name, '→', result.slice(0, 120));
  },
};

const hooks = new HookPipeline();
hooks.register(audit);
hooks.onTrace((trace) => console.log(trace)); // which hook, latency, changed?
```

### 5. Guardrails (protocol)

The kernel only defines the executable `GuardrailRule` protocol (`validate({ toolName, args?, result? }) → { allowed, reason }`) and injects rules via `PluginContext.registerGuardrail`. **Compiling the declarative `config.guardrails` into rules** lives in `@agent-engine/plugin-guardrails`.

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

### 6. Context assembly & the unified seam

```ts
import {
  buildSystemPrompt,
  renderTemplate,
  TokenBudgetCompactor,
  ApproximateTokenCounter,
} from '@agent-engine/core';
import type { ContextContributor } from '@agent-engine/core';

// renderTemplate / buildSystemPrompt only render user variables now —
// rules/skills/documents inject via ContextContributor (text + run-scoped tools), not template placeholders.
const rendered = renderTemplate('你是 {{role}}', { role: 'SRE' });
const prompt = buildSystemPrompt({ systemPrompt: { template: '你是 SRE。', variables: {} } });

// a ContextContributor is the single seam for capabilities to inject into the prompt + registry
const contributor: ContextContributor = {
  name: 'my-notes',
  async contribute({ userInput }) {
    return { text: `[笔记] 关于「${userInput}」的补充说明` };
  },
};

const compactor = new TokenBudgetCompactor(new ApproximateTokenCounter());
const kept = await compactor.compact(messages, 4000); // drop whole turns, keep within budget
```

### 7. Memory

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

// ③ long-term memory is a protocol here; the semantic implementation (SemanticMemory)
//    is @agent-engine/plugin-memory, injected via ResolveDeps.longTermMemoryFactory.
const longTerm = noopLongTermMemory; // core default
```

### 8. Retrieval (protocol + hybrid orchestration)

```ts
import {
  hybridRetrieve,
  reciprocalRankFusion,
  InMemoryVectorStore,
  noopRetriever,
} from '@agent-engine/core';

// each capability plugin builds its own index (MiniSearch lexical + optional InMemoryVectorStore)
// and reuses hybridRetrieve as the single BM25 + vector RRF orchestrator:
const hits = await hybridRetrieve('帮我写个组件', 5, {
  lexical: (query, topK) => lexicalIndex.search(query, topK), // your BM25 impl
  embedding: embeddingProvider,
  vectorStore,
  ensureVectors: async (ids) => embeddingProvider.embed(await textsFor(ids)),
});

// raw RRF: fuse multiple ranked lists without aligning score scales
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

### 10. Plugins

A plugin bundles tools + tool sources + hooks + guardrails + prompt fragments + context contributors + backends, installed via `PluginContext`.

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

### 11. Tool source (MCP protocol)

The kernel only defines `ToolSource { name; resolve() → { tools, dispose } }`; the MCP client (`connectMcpServer` / `connectMcpServers`) moved to `@agent-engine/plugin-mcp`.

```ts
import type { ToolSource } from '@agent-engine/core';

const source: ToolSource = {
  name: 'external',
  async resolve() {
    return { tools: [/* normalized Tool[] */], dispose: async () => {} };
  },
};
```

### 12. Sandbox

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

### 13. Events

```ts
import { EventBus } from '@agent-engine/core';

const bus = new EventBus();
const off = bus.on((event) => console.log(event));
bus.emit({ type: 'tool.registered', name: 'calculator' });
off();
```

### 14. Structured output

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

### 15. Cache

```ts
import { InMemoryCacheBackend } from '@agent-engine/core';

const cache = new InMemoryCacheBackend();
await cache.set('user:1', { plan: 'basic' }, 60_000); // TTL 60s
await cache.get('user:1'); // → { plan: 'basic' }
await cache.delete('user:1');
```

## Subpath exports

| Subpath                 | Module     | Highlights                                                                                                                                                                       |
| ----------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@agent-engine/core`    | —          | `AgentLoop`, `assembleAgentLoop`, `resolveAgentConfig`, all backends & types                                                                                                     |
| `.../llm`               | LLM        | `createProvider` / `createOpenAIProvider` / `createAnthropicProvider`, `LLMProvider`, `FinishReason`, `CompletionError`, `AbortError`, sampling params                           |
| `.../tools`             | Tools      | `Tool`, `ToolRegistry`, `registerBuiltinTools` (todo/datetime), `create*FileTool`, `createBashTool`, utils (`defaultFetch`, `resolveWithinRoot`, `TodoStore`, `checkBashPolicy`) |
| `.../agent`             | Agent      | `AgentLoop`, `assembleAgentLoop`, `ToolApproval` (HITL), `AgentRunOutcome`                                                                                                       |
| `.../hooks`             | Hooks      | `Hook`, `HookPipeline`, `HookPoint`, `HookTrace`                                                                                                                                 |
| `.../guardrails`        | Guardrails | `GuardrailRule`, `GuardrailContext`, `GuardrailResult` (protocol only)                                                                                                           |
| `.../context`           | Context    | `ContextComposer`, `buildSystemPrompt`, `renderTemplate`, `ContextContributor`, `TokenCounter`, `ContextCompactor`                                                               |
| `.../memory`            | Memory     | `ConversationMemory`, `MemoryBackend`, `Summarizer`, `LongTermMemory`, `noopLongTermMemory`, `LLMSummarizer`                                                                     |
| `.../retrieval`         | Retrieval  | `hybridRetrieve`, `Retriever`, `Reranker`, `IdentityReranker`, `noopRetriever`, `reciprocalRankFusion`, `InMemoryVectorStore`, `VectorStore`                                     |
| `.../embedding`         | Embedding  | `EmbeddingProvider`, `createEmbeddingProvider`                                                                                                                                   |
| `.../plugins`           | Plugins    | `Plugin`, `PluginContext`, `PluginManager`                                                                                                                                       |
| `.../capability`        | Capability | `CapabilityBundle`, `mergeBundles`                                                                                                                                               |
| `.../capability-source` | Sources    | `ToolSource`                                                                                                                                                                     |
| `.../resolve`           | Resolve    | `resolveAgentConfig` (config → `ResolvedAgent`)                                                                                                                                  |
| `.../sandbox`           | Sandbox    | `SandboxBackend` (docker/nsjail), `WasiFunctionSandbox`                                                                                                                          |
| `.../events`            | Events     | `EventBus`, `AgentEngineEvent`                                                                                                                                                   |
| `.../structured-output` | Structured | `extractStructured` (JSON mode + Zod + retry)                                                                                                                                    |
| `.../cache`             | Cache      | `CacheBackend`, `InMemoryCacheBackend`                                                                                                                                           |

## Capability map

Things that **used to be in core** now live in capability plugins (each keeps its own index and reuses `hybridRetrieve` + `ContextContributor`):

| Capability                           | Where it lives now                              |
| ------------------------------------ | ----------------------------------------------- |
| rules (load + retrieve + inject)     | `@agent-engine/plugin-rules`                    |
| skills (load path/npm/git + bundle)  | `@agent-engine/plugin-skills`                   |
| documents (normalize/chunk/retrieve) | `@agent-engine/plugin-documents`                |
| semantic long-term memory            | `@agent-engine/plugin-memory`                   |
| `web_search` / `web_fetch`           | `@agent-engine/plugin-web`                      |
| MCP client (stdio)                   | `@agent-engine/plugin-mcp`                      |
| declarative guardrail compilation    | `@agent-engine/plugin-guardrails`               |
| file / bash / git tool suites        | `@agent-engine/plugin-files` / `-bash` / `-git` |
| OpenTelemetry observability          | `@agent-engine/plugin-otel`                     |
| all-of-the-above aggregation         | `@agent-engine/preset-default`                  |

## Design notes

- **Thin kernel**: the kernel keeps the engine + protocols; domain capabilities are externalized as `plugin-*`. Nothing in core reads `config.rules` / `config.skills` / `config.documents` / `config.mcp` — plugins interpret those slices.
- **Self-built kernel + SDK reuse**: loop / plugins / hooks / guardrails protocol are self-built; LLM / vectors reuse official SDKs. No LangChain.
- **Multi-model boundary**: `LLMProvider` covers chat only; embedding is a separate `EmbeddingProvider`.
- **hooks vs guardrails**: hooks observe/rewrite; guardrails block.

## Dependencies

- `@agent-engine/config` (schema types)
- `openai` / `@anthropic-ai/sdk` (LLM SDKs)
- `picomatch` (glob matching), `zod` (runtime validation)
- dev: `wabt` (WASI compile)

> Removed from core during the capability externalization: `minisearch`, `mammoth`, `epub2`, `turndown`, `unpdf`, `gray-matter`, `@mozilla/readability`, `linkedom`, `@modelcontextprotocol/sdk` — these now belong to their respective `plugin-*` packages.

## Status

✅ Implemented (M1–M3 thin kernel; multi-agent orchestration is deferred to a separate package).
