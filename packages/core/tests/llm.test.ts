import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  openaiCreate: rs.fn(),
  anthropicCreate: rs.fn(),
  openaiOptions: null as { apiKey: string; baseURL?: string } | null,
  anthropicOptions: null as { apiKey: string; baseURL?: string } | null,
}));

rs.mock('openai', () => ({
  default: class {
    chat = { completions: { create: mocks.openaiCreate } };
    constructor(opts: { apiKey: string; baseURL?: string }) {
      mocks.openaiOptions = opts;
    }
  },
}));

rs.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mocks.anthropicCreate };
    constructor(opts: { apiKey: string; baseURL?: string }) {
      mocks.anthropicOptions = opts;
    }
  },
}));

import { createAnthropicProvider } from '../src/llm/anthropic';
import { createOpenAIProvider } from '../src/llm/openai';
import { createProvider } from '../src/llm/provider';

describe('createProvider 分派', () => {
  afterEach(() => {
    rs.clearAllMocks();
  });

  it('openai-compatible 分派到 OpenAI 兼容实现', () => {
    const provider = createProvider({
      provider: 'openai-compatible',
      model: 'deepseek-chat',
      apiKey: 'test-key',
    });
    expect(provider.name).toBe('openai-compatible');
  });

  it('anthropic 分派到 Anthropic 实现', () => {
    const provider = createProvider({
      provider: 'anthropic',
      model: 'claude-sonnet',
      apiKey: 'test-key',
    });
    expect(provider.name).toBe('anthropic');
  });

  it('custom 走 OpenAI 兼容实现', () => {
    const provider = createProvider({
      provider: 'custom',
      model: 'local-model',
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'test-key',
    });
    expect(provider.name).toBe('custom');
  });
});

describe('OpenAI 兼容实现', () => {
  beforeEach(() => {
    mocks.openaiCreate.mockReset();
    mocks.openaiOptions = null;
  });

  it('默认 baseURL 为 DeepSeek', () => {
    createOpenAIProvider({
      provider: 'openai-compatible',
      model: 'deepseek-chat',
      apiKey: 'test-key',
    });
    expect(mocks.openaiOptions?.baseURL).toBe('https://api.deepseek.com');
  });

  it('显式 baseURL 优先', () => {
    createOpenAIProvider({
      provider: 'custom',
      model: 'local-model',
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'test-key',
    });
    expect(mocks.openaiOptions?.baseURL).toBe('http://localhost:11434/v1');
  });

  it('config.apiKey 生效', () => {
    createOpenAIProvider({
      provider: 'openai-compatible',
      model: 'deepseek-chat',
      apiKey: 'from-config',
    });
    expect(mocks.openaiOptions?.apiKey).toBe('from-config');
  });

  it('密钥缺失时抛错', () => {
    expect(() =>
      createOpenAIProvider({ provider: 'openai-compatible', model: 'deepseek-chat' }),
    ).toThrow(/config\.model\.apiKey/);
  });

  it('采样参数从配置透传（含 temperature/maxTokens）', async () => {
    mocks.openaiCreate.mockResolvedValue({
      choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'ok' } }],
    });

    const provider = createOpenAIProvider({
      provider: 'openai-compatible',
      model: 'deepseek-chat',
      apiKey: 'test-key',
      temperature: 0.2,
      maxTokens: 2048,
      topP: 0.7,
      frequencyPenalty: 0.3,
      presencePenalty: 0.1,
      stop: ['END'],
      seed: 42,
    });
    await provider.chatCompletion({ messages: [{ role: 'user', content: 'x' }] });

    const req = mocks.openaiCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(req.temperature).toBe(0.2);
    expect(req.max_tokens).toBe(2048);
    expect(req.top_p).toBe(0.7);
    expect(req.frequency_penalty).toBe(0.3);
    expect(req.presence_penalty).toBe(0.1);
    expect(req.stop).toEqual(['END']);
    expect(req.seed).toBe(42);
  });

  it('调用级参数覆盖配置缺省', async () => {
    mocks.openaiCreate.mockResolvedValue({
      choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'ok' } }],
    });

    const provider = createOpenAIProvider({
      provider: 'openai-compatible',
      model: 'deepseek-chat',
      apiKey: 'test-key',
      topP: 0.7,
    });
    await provider.chatCompletion({
      messages: [{ role: 'user', content: 'x' }],
      topP: 0.3,
    });

    const req = mocks.openaiCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(req.top_p).toBe(0.3);
  });

  it('响应归一化（含 tool_calls）', async () => {
    mocks.openaiCreate.mockResolvedValue({
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'get_weather', arguments: '{"city":"beijing"}' },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });

    const provider = createOpenAIProvider({
      provider: 'openai-compatible',
      model: 'deepseek-chat',
      apiKey: 'test-key',
    });
    const result = await provider.chatCompletion({
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(result.message.role).toBe('assistant');
    expect(result.message.toolCalls?.[0]).toMatchObject({
      id: 'call_1',
      function: { name: 'get_weather', arguments: '{"city":"beijing"}' },
    });
    expect(result.usage?.totalTokens).toBe(30);
    expect(result.finishReason).toBe('tool_calls');
  });

  it('非流式透传 reasoning_content', async () => {
    mocks.openaiCreate.mockResolvedValue({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'final answer',
            reasoning_content: 'thinking...',
          },
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });

    const provider = createOpenAIProvider({
      provider: 'openai-compatible',
      model: 'deepseek-reasoner',
      apiKey: 'test-key',
    });
    const result = await provider.chatCompletion({
      messages: [{ role: 'user', content: 'x' }],
    });

    expect(result.message.reasoning).toBe('thinking...');
    expect(result.message.content).toBe('final answer');
  });

  it('流式 reasoning_content 分片累积并按 kind 回调', async () => {
    async function* mockStream() {
      yield { choices: [{ delta: { reasoning_content: 'thinking ' }, finish_reason: null }] };
      yield { choices: [{ delta: { reasoning_content: 'hard' }, finish_reason: null }] };
      yield { choices: [{ delta: { content: 'answer' }, finish_reason: null }] };
      yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
    }
    mocks.openaiCreate.mockResolvedValue(mockStream());

    const provider = createOpenAIProvider({
      provider: 'openai-compatible',
      model: 'deepseek-reasoner',
      apiKey: 'test-key',
    });
    const reasoningDeltas: string[] = [];
    const contentDeltas: string[] = [];
    const result = await provider.chatCompletionStream(
      { messages: [{ role: 'user', content: 'x' }] },
      (delta, kind) => {
        if (kind === 'reasoning') reasoningDeltas.push(delta);
        else contentDeltas.push(delta);
      },
    );

    expect(reasoningDeltas).toEqual(['thinking ', 'hard']);
    expect(contentDeltas).toEqual(['answer']);
    expect(result.message.reasoning).toBe('thinking hard');
    expect(result.message.content).toBe('answer');
  });
});

describe('Anthropic 实现', () => {
  beforeEach(() => {
    mocks.anthropicCreate.mockReset();
    mocks.anthropicOptions = null;
  });

  it('密钥缺失时抛错', () => {
    expect(() => createAnthropicProvider({ provider: 'anthropic', model: 'claude' })).toThrow(
      /config\.model\.apiKey/,
    );
  });

  it('config.apiKey 生效', () => {
    createAnthropicProvider({ provider: 'anthropic', model: 'claude', apiKey: 'from-config' });
    expect(mocks.anthropicOptions?.apiKey).toBe('from-config');
  });

  it('采样参数归一化：top_p / stop_sequences 透传，frequencyPenalty 忽略', async () => {
    mocks.anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 1, output_tokens: 1 },
      stop_reason: 'end_turn',
    });

    const provider = createAnthropicProvider({
      provider: 'anthropic',
      model: 'claude',
      apiKey: 'test-key',
      temperature: 0.2,
      maxTokens: 2048,
      topP: 0.7,
      frequencyPenalty: 0.3,
      presencePenalty: 0.1,
      stop: ['END'],
      seed: 42,
    });
    await provider.chatCompletion({ messages: [{ role: 'user', content: 'x' }] });

    const req = mocks.anthropicCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(req.temperature).toBe(0.2);
    expect(req.max_tokens).toBe(2048);
    expect(req.top_p).toBe(0.7);
    expect(req.stop_sequences).toEqual(['END']);
    expect(req.frequency_penalty).toBeUndefined();
    expect(req.presence_penalty).toBeUndefined();
    expect(req.seed).toBeUndefined();
  });

  it('tool_use 归一化为 ToolCall', async () => {
    mocks.anthropicCreate.mockResolvedValue({
      content: [
        { type: 'text', text: 'The weather is ' },
        { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'beijing' } },
      ],
      usage: { input_tokens: 10, output_tokens: 20 },
      stop_reason: 'tool_use',
    });

    const provider = createAnthropicProvider({
      provider: 'anthropic',
      model: 'claude',
      apiKey: 'test-key',
    });
    const result = await provider.chatCompletion({
      messages: [{ role: 'user', content: 'weather in beijing?' }],
    });

    expect(result.message.content).toBe('The weather is ');
    expect(result.message.toolCalls?.[0]).toMatchObject({
      id: 'toolu_1',
      function: { name: 'get_weather', arguments: '{"city":"beijing"}' },
    });
    expect(result.finishReason).toBe('tool_calls');
  });

  it('多个连续 tool 结果合并进单个 user 消息（Anthropic 协议要求）', async () => {
    mocks.anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'done' }],
      usage: { input_tokens: 10, output_tokens: 20 },
      stop_reason: 'end_turn',
    });

    const provider = createAnthropicProvider({
      provider: 'anthropic',
      model: 'claude',
      apiKey: 'test-key',
    });
    await provider.chatCompletion({
      messages: [
        { role: 'user', content: 'x' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            { id: 'call_1', type: 'function', function: { name: 't1', arguments: '{}' } },
            { id: 'call_2', type: 'function', function: { name: 't2', arguments: '{}' } },
          ],
        },
        { role: 'tool', content: 'r1', toolCallId: 'call_1', name: 't1' },
        { role: 'tool', content: 'r2', toolCallId: 'call_2', name: 't2' },
      ],
    });

    const sentMessages = mocks.anthropicCreate.mock.calls[0][0].messages as {
      role: string;
      content: { type: string; tool_use_id?: string; content?: string }[];
    }[];
    const toolResultMessages = sentMessages.filter(
      (m) =>
        m.role === 'user' &&
        Array.isArray(m.content) &&
        m.content.some((b) => b.type === 'tool_result'),
    );
    expect(toolResultMessages.length).toBe(1);
    expect(toolResultMessages[0].content).toHaveLength(2);
    expect(toolResultMessages[0].content[0]).toMatchObject({
      tool_use_id: 'call_1',
      content: 'r1',
    });
    expect(toolResultMessages[0].content[1]).toMatchObject({
      tool_use_id: 'call_2',
      content: 'r2',
    });
  });

  it('流式下 text block 在前时 tool_use 参数按 block index 正确回填', async () => {
    async function* mockStream() {
      yield { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } };
      yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hi' } };
      yield {
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'tool_use', id: 'toolu_1', name: 'get_weather' },
      };
      yield {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '{"city":' },
      };
      yield {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '"beijing"}' },
      };
      yield { type: 'message_delta', delta: { stop_reason: 'tool_use' } };
    }
    mocks.anthropicCreate.mockResolvedValue(mockStream());

    const provider = createAnthropicProvider({
      provider: 'anthropic',
      model: 'claude',
      apiKey: 'test-key',
    });
    const result = await provider.chatCompletionStream(
      { messages: [{ role: 'user', content: 'x' }] },
      () => {},
    );

    expect(result.message.toolCalls?.[0]).toMatchObject({
      id: 'toolu_1',
      function: { name: 'get_weather', arguments: '{"city":"beijing"}' },
    });
  });
});
