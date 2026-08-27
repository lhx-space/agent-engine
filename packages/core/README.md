# @agent-engine/core

Agent kernel execution engine: LLM Provider abstraction, Tool registry, single-agent ReAct loop, hooks / rules / guardrails, pluggable memory / retrieval / embedding backends, MCP client, execution sandbox and event bus.

> **Design rule**: every capability is an **interface + in-memory default + injection point** (`PluginContext.register*` + `CapabilityBundle` + `ResolvedAgent`). Concrete backends (pgvector / redis / embedding models / caches) are supplied by users or the ecosystem — the kernel only adapts.

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
await resolved.dispose(); // release MCP connections etc.
```

`agent.yaml`:

```yaml
name: hello-agent
model: { provider: openai-compatible, baseURL: https://api.deepseek.com/v1, model: deepseek-chat }
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
    // ... call your backend, return a normalized ChatCompletionResult
    return { message: { role: 'assistant', content: 'ok' } };
  },
};

const result = await provider.chatCompletion({ messages: [{ role: 'user', content: 'hi' }] });
```

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

Built-in primitives (`todo` / `datetime` / `web_search` / `web_fetch`) are registered via `registerBuiltinTools(registry, security)`; vertical tools (`createReadFileTool` / `createBashTool` / …) are factories in `core/tools`.

### 3. Agent loop runtime options

`agent.run(userInput, options?)` supports streaming, events, Human-in-the-loop approval and cancellation.

```ts
import { AbortError } from '@agent-engine/core';

// streaming + events
const controller = new AbortController();
const result = await resolved.agent.run('给我写个脚本', {
  signal: controller.signal,
  onEvent: (event) => {
    if (event.type === 'llm_delta') process.stdout.write(event.delta);
    if (event.type === 'tool_call') console.log('calling', event.name, event.args);
    if (event.type === 'done') console.log('\nsteps:', event.steps);
  },
  // Human-in-the-loop: block a sensitive tool before execution
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
    // return a rewritten messages array to change it, or void to keep it
  },
  async afterToolCall(name, result) {
    console.log('tool', name, '→', result.slice(0, 120));
  },
};

const hooks = new HookPipeline();
hooks.register(audit);
hooks.onTrace((trace) => console.log(trace)); // observability: which hook, latency, changed?
```

### 5. Rules & guardrails

Text rules are injected into the prompt (`always` or retrieved `on-demand`); guardrails are executable and block.

```ts
import {
  CapabilityLoader,
  compileGuardrails,
  loadRulesText,
  RuleRegistry,
} from '@agent-engine/core';

const rules = [
  { id: 'r1', kind: 'always', description: '简洁', content: '回答要简洁', tags: [] },
  {
    id: 'r2',
    kind: 'on-demand',
    description: 'K8s 诊断',
    content: '先 events 再 logs',
    tags: ['k8s'],
  },
];

const loader = new CapabilityLoader('rule', rules);
const injected = await loadRulesText(rules, loader, 'k8s 故障怎么排查', 5);

// declarative guardrail → executable rule
const registry = new RuleRegistry();
for (const rule of compileGuardrails([
  { id: 'deny-rm', on: 'beforeToolCall', denyTools: ['bash'], denyPatterns: ['rm -rf'] },
])) {
  registry.register(rule);
}
const verdict = await registry.forPoint('beforeToolCall')[0]!.validate({
  toolName: 'bash',
  args: 'rm -rf /',
});
// verdict.allowed === false
```

### 6. Context assembly & token budget

```ts
import {
  buildSystemPrompt,
  renderTemplate,
  TokenBudgetCompactor,
  ApproximateTokenCounter,
} from '@agent-engine/core';

const rendered = renderTemplate('你是 {{role}}', { role: 'SRE' });
const prompt = buildSystemPrompt({
  systemPrompt: { template: '你是 SRE。\n规则：\n{{rules}}' },
  rulesText: '禁止破坏性命令',
});

const compactor = new TokenBudgetCompactor(new ApproximateTokenCounter());
const kept = await compactor.compact(messages, 4000); // drop whole turns, keep within budget
```

### 7. Memory (three-tier)

```ts
import {
  ConversationMemory,
  InMemoryMemoryBackend,
  LLMSummarizer,
  SemanticMemory,
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
const window = await memory.getWindow(); // summary (if any) + kept turns

// ③ 语义长期记忆：embedding + vector store + durable KV
const longTerm = new SemanticMemory(vectorStore, embeddingProvider, new InMemoryMemoryBackend());
await longTerm.remember('用户偏好：部署前先跑一次 dry-run');
const recalled = await longTerm.recall('部署流程', 3); // ['用户偏好：部署前先跑一次 dry-run']
```

### 8. Retrieval (BM25 + vector RRF)

```ts
import { CapabilityRegistry, CapabilityLoader, reciprocalRankFusion } from '@agent-engine/core';

const registry = new CapabilityRegistry({ embedding: embeddingProvider /* optional */ });
registry.register({ id: 'r1', type: 'rule', description: 'Vue 编码规范', tags: ['vue'] });
const hits = await registry.retrieve('帮我写个组件', 5); // [{ meta, score }]

// raw RRF: fuse multiple ranked lists without aligning score scales
const fused = reciprocalRankFusion([
  [
    { id: 'a', score: 9 },
    { id: 'b', score: 5 },
  ],
  [{ id: 'b', score: 9 }],
]); // → [{ id: 'b', score: … }, { id: 'a', score: … }]
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

### 10. Documents

Normalize → chunk → index → retrieve (BM25, or BM25 + vector RRF when embedding is provided).

```ts
import {
  DocumentIndex,
  FixedSizeChunker,
  loadDocuments,
  MarkdownHeadingChunker,
  PdfNormalizer,
} from '@agent-engine/core';

const doc = await new PdfNormalizer().normalize({ path: 'a.pdf', content: pdfBytes });
const chunks = new MarkdownHeadingChunker({ size: 1000 }).chunk(doc.markdown);

const index = new DocumentIndex({ topK: 4, embedding: embeddingProvider });
await index.addChunks(chunks.map((c) => ({ text: c.text, metadata: c.metadata })));
const hits = await index.retrieve('如何配置 CI', 4);

// one-shot: enumerate sources → normalize → chunk → index
const loaded = await loadDocuments({
  sources: ['./knowledge'],
  chunking: { strategy: 'heading' },
  topK: 4,
});
```

### 11. MCP

```ts
import { connectMcpServer, connectMcpServers } from '@agent-engine/core';

const conn = await connectMcpServer({
  name: 'github',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: { GITHUB_TOKEN: '...' },
});
// conn.tools: MCP tools normalized into standard Tool[]
await conn.close();

// connect many; a single failure does not block the rest
const { bundle, errors } = await connectMcpServers([/* ... */]);
```

### 12. Plugins

A plugin bundles tools + skills + hooks + rules + backends and installs them via `PluginContext`.

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
    ctx.provideSystemPrompt('本插件已加载。');
  },
};

const manager = new PluginManager();
await manager.install(plugin);
const bundle = manager.getAssembly(); // CapabilityBundle
```

### 13. Sandbox

```ts
import { resolveSandboxBackend, WasiFunctionSandbox } from '@agent-engine/core';

// native commands: docker / nsjail / auto
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

// untrusted WASI code (node:wasi, zero Docker)
const wasi = new WasiFunctionSandbox();
const out = await wasi.exec({ wasm: compiledWasmBytes, args: ['arg1'], timeoutMs: 2000 });
```

### 14. Events

```ts
import { EventBus } from '@agent-engine/core';

const bus = new EventBus();
const off = bus.on((event) => console.log(event));
bus.emit({ type: 'tool.registered', name: 'calculator' });
off();
```

### 15. Structured output

```ts
import { z } from 'zod';
import { extractStructured } from '@agent-engine/core';

const schema = z.object({ severity: z.enum(['low', 'high']), summary: z.string() });
const parsed = await extractStructured({
  provider,
  schema,
  messages: [{ role: 'user', content: '这是一次事故报告：...' }],
});
// parsed: { severity: 'high', summary: '...' } — JSON mode + Zod validate + retry
```

### 16. Cache

```ts
import { InMemoryCacheBackend } from '@agent-engine/core';

const cache = new InMemoryCacheBackend();
await cache.set('user:1', { plan: 'basic' }, 60_000); // TTL 60s
await cache.get('user:1'); // → { plan: 'basic' }
await cache.delete('user:1');
```

## Subpath exports

| Subpath                 | Module     | Highlights                                                                                                                            |
| ----------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `@agent-engine/core`    | —          | `AgentLoop`, `assembleAgentLoop`, `resolveAgentConfig`, all backends & types                                                          |
| `.../llm`               | LLM        | `createProvider` / `createOpenAIProvider` / `createAnthropicProvider`, `LLMProvider`, `FinishReason`, `CompletionError`, `AbortError` |
| `.../tools`             | Tools      | `Tool`, `ToolRegistry`, builtin primitives, `createBashTool` / `createFileTool`s                                                      |
| `.../agent`             | Agent      | `AgentLoop`, `assembleAgentLoop`, `ToolApproval` (HITL), `AgentRunOutcome`                                                            |
| `.../hooks`             | Hooks      | `Hook`, `HookPipeline` (10 lifecycle points)                                                                                          |
| `.../rules`             | Rules      | `RuleRegistry`, `GuardrailRule`, `compileGuardrails`, `loadRulesText`                                                                 |
| `.../context`           | Context    | `ContextComposer`, `buildSystemPrompt`, `renderTemplate`, `TokenCounter`, `ContextCompactor`                                          |
| `.../documents`         | Documents  | normalizers (text/html/pdf/docx/epub), chunkers, `DocumentIndex` (BM25 + RRF), `loadDocuments`                                        |
| `.../memory`            | Memory     | `ConversationMemory`, `MemoryBackend`, `Summarizer`, `SemanticMemory`                                                                 |
| `.../retrieval`         | Retrieval  | `CapabilityRegistry` (BM25 + RRF), `CapabilityLoader`, `Retriever`, `Reranker`, `VectorStore`, `reciprocalRankFusion`                 |
| `.../embedding`         | Embedding  | `EmbeddingProvider`, `createEmbeddingProvider`                                                                                        |
| `.../mcp`               | MCP        | `connectMcpServer` / `connectMcpServers`                                                                                              |
| `.../plugins`           | Plugins    | `Plugin`, `PluginContext`, `PluginManager`                                                                                            |
| `.../capability`        | Capability | `CapabilityBundle`, `mergeBundles`                                                                                                    |
| `.../capability-source` | Sources    | `resolveSkill(s)`, `resolveMcpServer(s)`                                                                                              |
| `.../resolve`           | Resolve    | `resolveAgentConfig` (config → `ResolvedAgent`)                                                                                       |
| `.../sandbox`           | Sandbox    | `SandboxBackend` (docker/nsjail), `WasiFunctionSandbox`                                                                               |
| `.../events`            | Events     | `EventBus`, `AgentEngineEvent`                                                                                                        |
| `.../skills`            | Skills     | `Skill`, `loadSkillFromPath`                                                                                                          |
| `.../structured-output` | Structured | `extractStructured` (JSON mode + Zod + retry)                                                                                         |
| `.../cache`             | Cache      | `CacheBackend`, `InMemoryCacheBackend`                                                                                                |

## Design notes

- **Self-built kernel + SDK reuse**: loop / plugins / hooks / rules / guardrails are self-built; LLM / MCP / vectors reuse official SDKs. No LangChain.
- **Multi-model boundary**: `LLMProvider` covers chat only; embedding is a separate `EmbeddingProvider`.
- **hooks vs guardrails**: hooks observe/rewrite; guardrails block.

## Dependencies

- `@agent-engine/config` (schema types)
- `openai` / `@anthropic-ai/sdk` (LLM SDKs)
- `@modelcontextprotocol/sdk` (MCP)
- `minisearch` (BM25), `picomatch`, `zod`, `linkedom` + `@mozilla/readability` (web fetch)
- `turndown` (HTML → Markdown), `unpdf` (PDF), `mammoth` (docx), `epub2` (epub)

## Status

✅ Implemented (M1–M3 core; multi-agent orchestration is deferred to a separate package).
