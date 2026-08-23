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
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  });

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    rs.clearAllMocks();
  });

  it('openai-compatible 分派到 OpenAI 兼容实现', () => {
    const provider = createProvider({ provider: 'openai-compatible', model: 'deepseek-chat' });
    expect(provider.name).toBe('openai-compatible');
  });

  it('anthropic 分派到 Anthropic 实现', () => {
    const provider = createProvider({ provider: 'anthropic', model: 'claude-sonnet' });
    expect(provider.name).toBe('anthropic');
  });

  it('custom 走 OpenAI 兼容实现', () => {
    const provider = createProvider({
      provider: 'custom',
      model: 'local-model',
      baseURL: 'http://localhost:11434/v1',
    });
    expect(provider.name).toBe('custom');
  });
});

describe('OpenAI 兼容实现', () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
    mocks.openaiCreate.mockReset();
    mocks.openaiOptions = null;
  });

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('默认 baseURL 为 DeepSeek', () => {
    createOpenAIProvider({ provider: 'openai-compatible', model: 'deepseek-chat' });
    expect(mocks.openaiOptions?.baseURL).toBe('https://api.deepseek.com');
  });

  it('显式 baseURL 优先', () => {
    createOpenAIProvider({
      provider: 'custom',
      model: 'local-model',
      baseURL: 'http://localhost:11434/v1',
    });
    expect(mocks.openaiOptions?.baseURL).toBe('http://localhost:11434/v1');
  });

  it('密钥缺失时抛错', () => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(() =>
      createOpenAIProvider({ provider: 'openai-compatible', model: 'deepseek-chat' }),
    ).toThrow(/DEEPSEEK_API_KEY/);
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
});

describe('Anthropic 实现', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    mocks.anthropicCreate.mockReset();
    mocks.anthropicOptions = null;
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('密钥缺失时抛错', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => createAnthropicProvider({ provider: 'anthropic', model: 'claude' })).toThrow(
      /ANTHROPIC_API_KEY/,
    );
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

    const provider = createAnthropicProvider({ provider: 'anthropic', model: 'claude' });
    const result = await provider.chatCompletion({
      messages: [{ role: 'user', content: 'weather in beijing?' }],
    });

    expect(result.message.content).toBe('The weather is ');
    expect(result.message.toolCalls?.[0]).toMatchObject({
      id: 'toolu_1',
      function: { name: 'get_weather', arguments: '{"city":"beijing"}' },
    });
    expect(result.finishReason).toBe('tool_use');
  });
});
