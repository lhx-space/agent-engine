# @agent-engine/core

Agent 内核执行引擎：LLM Provider 抽象、Tool 注册表、单 Agent ReAct 循环、hooks / rules / guardrails、可插拔的记忆 / 检索 / embedding 后端、MCP client、执行沙箱与事件总线。

> **设计铁律**：每个能力都是「**接口 + in-memory 默认 + 注入点**」（`PluginContext.register*` + `CapabilityBundle` + `ResolvedAgent`）。具体后端（pgvector / redis / embedding 模型 / 缓存）由用户或生态接入，内核只做适配。

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
await resolved.dispose(); // 释放 MCP 连接等资源
```

`agent.yaml`：

```yaml
name: hello-agent
model: { provider: openai-compatible, baseURL: https://api.deepseek.com/v1, model: deepseek-chat }
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
    // ... 调你自己的后端，返回归一化 ChatCompletionResult
    return { message: { role: 'assistant', content: 'ok' } };
  },
};

const result = await provider.chatCompletion({ messages: [{ role: 'user', content: 'hi' }] });
```

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

内置原语（`todo` / `datetime` / `web_search` / `web_fetch`）经 `registerBuiltinTools(registry, security)` 注册；垂直工具（`createReadFileTool` / `createBashTool` / …）是 `core/tools` 下的工厂。

### 3. AgentLoop 运行选项

`agent.run(userInput, options?)` 支持流式、事件、Human-in-the-loop 审批与取消。

```ts
import { AbortError } from '@agent-engine/core';

// 流式 + 事件
const controller = new AbortController();
const result = await resolved.agent.run('给我写个脚本', {
  signal: controller.signal,
  onEvent: (event) => {
    if (event.type === 'llm_delta') process.stdout.write(event.delta);
    if (event.type === 'tool_call') console.log('调用', event.name, event.args);
    if (event.type === 'done') console.log('\n步数:', event.steps);
  },
  // Human-in-the-loop：敏感工具执行前需人工确认
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
    // 返回改写后的 messages 数组以修改，或返回 void 保持原样
  },
  async afterToolCall(name, result) {
    console.log('工具', name, '→', result.slice(0, 120));
  },
};

const hooks = new HookPipeline();
hooks.register(audit);
hooks.onTrace((trace) => console.log(trace)); // 可观测：哪个 hook、耗时、是否改写
```

### 5. Rules 与 guardrails

文本规则注入 prompt（`always` 或按需检索 `on-demand`）；guardrail 可执行、负责阻断。

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

// 声明式 guardrail → 可执行规则
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

### 6. 上下文组装与 token 预算

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
const kept = await compactor.compact(messages, 4000); // 按整轮淘汰，控制在预算内
```

### 7. 记忆（三层）

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
const window = await memory.getWindow(); // 摘要（若有）+ 保留的轮次

// ③ 语义长期记忆：embedding + 向量库 + 持久化 KV
const longTerm = new SemanticMemory(vectorStore, embeddingProvider, new InMemoryMemoryBackend());
await longTerm.remember('用户偏好：部署前先跑一次 dry-run');
const recalled = await longTerm.recall('部署流程', 3); // ['用户偏好：部署前先跑一次 dry-run']
```

### 8. 检索（BM25 + 向量 RRF）

```ts
import { CapabilityRegistry, CapabilityLoader, reciprocalRankFusion } from '@agent-engine/core';

const registry = new CapabilityRegistry({ embedding: embeddingProvider /* 可选 */ });
registry.register({ id: 'r1', type: 'rule', description: 'Vue 编码规范', tags: ['vue'] });
const hits = await registry.retrieve('帮我写个组件', 5); // [{ meta, score }]

// 原始 RRF：融合多路排名，无需对齐分数尺度
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

### 10. 文档

归一化 → 分块 → 索引 → 检索（BM25，配置 embedding 时升级为 BM25 + 向量 RRF）。

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

// 一步到位：枚举 sources → 归一化 → 分块 → 索引
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
// conn.tools：MCP 工具已归一化为标准 Tool[]
await conn.close();

// 批量连接；单个失败不阻断其余
const { bundle, errors } = await connectMcpServers([/* ... */]);
```

### 12. 插件

插件打包「tools + skills + hooks + rules + 后端」，经 `PluginContext` 一次性注入。

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

### 13. 沙箱

```ts
import { resolveSandboxBackend, WasiFunctionSandbox } from '@agent-engine/core';

// 原生命令：docker / nsjail / auto
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

// 不可信 WASI 代码（node:wasi，零 Docker）
const wasi = new WasiFunctionSandbox();
const out = await wasi.exec({ wasm: compiledWasmBytes, args: ['arg1'], timeoutMs: 2000 });
```

### 14. 事件总线

```ts
import { EventBus } from '@agent-engine/core';

const bus = new EventBus();
const off = bus.on((event) => console.log(event));
bus.emit({ type: 'tool.registered', name: 'calculator' });
off();
```

### 15. 结构化输出

```ts
import { z } from 'zod';
import { extractStructured } from '@agent-engine/core';

const schema = z.object({ severity: z.enum(['low', 'high']), summary: z.string() });
const parsed = await extractStructured({
  provider,
  schema,
  messages: [{ role: 'user', content: '这是一次事故报告：...' }],
});
// parsed: { severity: 'high', summary: '...' } —— JSON 模式 + Zod 校验 + 重试
```

### 16. 缓存

```ts
import { InMemoryCacheBackend } from '@agent-engine/core';

const cache = new InMemoryCacheBackend();
await cache.set('user:1', { plan: 'basic' }, 60_000); // TTL 60s
await cache.get('user:1'); // → { plan: 'basic' }
await cache.delete('user:1');
```

## 子路径导出

| 子路径                  | 模块       | 要点                                                                                                                                  |
| ----------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `@agent-engine/core`    | —          | `AgentLoop`、`assembleAgentLoop`、`resolveAgentConfig`、各后端与类型                                                                  |
| `.../llm`               | LLM        | `createProvider` / `createOpenAIProvider` / `createAnthropicProvider`、`LLMProvider`、`FinishReason`、`CompletionError`、`AbortError` |
| `.../tools`             | Tools      | `Tool`、`ToolRegistry`、内置原语、`createBashTool` / `createFileTool`s                                                                |
| `.../agent`             | Agent      | `AgentLoop`、`assembleAgentLoop`、`ToolApproval`（HITL）、`AgentRunOutcome`                                                           |
| `.../hooks`             | Hooks      | `Hook`、`HookPipeline`（10 个生命周期点）                                                                                             |
| `.../rules`             | Rules      | `RuleRegistry`、`GuardrailRule`、`compileGuardrails`、`loadRulesText`                                                                 |
| `.../context`           | Context    | `ContextComposer`、`buildSystemPrompt`、`renderTemplate`、`TokenCounter`、`ContextCompactor`                                          |
| `.../documents`         | Documents  | 归一化器（text/html/pdf/docx/epub）、分块器、`DocumentIndex`（BM25 + RRF）、`loadDocuments`                                           |
| `.../memory`            | Memory     | `ConversationMemory`、`MemoryBackend`、`Summarizer`、`SemanticMemory`                                                                 |
| `.../retrieval`         | Retrieval  | `CapabilityRegistry`（BM25 + RRF）、`CapabilityLoader`、`Retriever`、`Reranker`、`VectorStore`、`reciprocalRankFusion`                |
| `.../embedding`         | Embedding  | `EmbeddingProvider`、`createEmbeddingProvider`                                                                                        |
| `.../mcp`               | MCP        | `connectMcpServer` / `connectMcpServers`                                                                                              |
| `.../plugins`           | Plugins    | `Plugin`、`PluginContext`、`PluginManager`                                                                                            |
| `.../capability`        | Capability | `CapabilityBundle`、`mergeBundles`                                                                                                    |
| `.../capability-source` | Sources    | `resolveSkill(s)`、`resolveMcpServer(s)`                                                                                              |
| `.../resolve`           | Resolve    | `resolveAgentConfig`（config → `ResolvedAgent`）                                                                                      |
| `.../sandbox`           | Sandbox    | `SandboxBackend`（docker/nsjail）、`WasiFunctionSandbox`                                                                              |
| `.../events`            | Events     | `EventBus`、`AgentEngineEvent`                                                                                                        |
| `.../skills`            | Skills     | `Skill`、`loadSkillFromPath`                                                                                                          |
| `.../structured-output` | Structured | `extractStructured`（JSON 模式 + Zod + 重试）                                                                                         |
| `.../cache`             | Cache      | `CacheBackend`、`InMemoryCacheBackend`                                                                                                |

## 设计说明

- **内核自研 + SDK 复用**：loop / plugins / hooks / rules / guardrails 自研；LLM / MCP / 向量复用官方 SDK。不引入 LangChain。
- **多模型边界**：`LLMProvider` 只覆盖 chat；embedding 是独立的 `EmbeddingProvider`。
- **hooks vs guardrails**：hooks 观察 / 改写；guardrails 阻断。

## 依赖

- `@agent-engine/config`（schema 类型）
- `openai` / `@anthropic-ai/sdk`（LLM SDK）
- `@modelcontextprotocol/sdk`（MCP）
- `minisearch`（BM25）、`picomatch`、`zod`、`linkedom` + `@mozilla/readability`（web fetch）
- `turndown`（HTML → Markdown）、`unpdf`（PDF）、`mammoth`（docx）、`epub2`（epub）

## 状态

✅ 已实现（M1–M3 内核；多 Agent 编排延后到独立包）。
