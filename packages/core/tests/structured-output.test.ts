import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';
import type { ChatCompletionParams, LLMProvider } from '../src/llm/types';
import { extractStructured } from '../src/structured-output';

function mockProvider(responses: string[]) {
  const calls: ChatCompletionParams[] = [];
  const provider: LLMProvider = {
    name: 'mock',
    async chatCompletion(params) {
      calls.push(params);
      const content = responses[calls.length - 1] ?? '';
      return { message: { role: 'assistant', content }, finishReason: 'stop' };
    },
  };
  return { provider, calls };
}

const schema = z.object({ name: z.string(), age: z.number().int() });

describe('extractStructured（结构化输出原语）', () => {
  it('解析成功返回强类型值 + 透传 responseFormat', async () => {
    const { provider, calls } = mockProvider(['{"name":"alice","age":30}']);
    const result = await extractStructured({
      provider,
      schema,
      messages: [{ role: 'user', content: '介绍 alice' }],
    });
    expect(result).toEqual({ name: 'alice', age: 30 });
    expect(calls[0]?.responseFormat).toEqual({ type: 'json_object' });
  });

  it('JSON 非法时回填重试', async () => {
    const { provider, calls } = mockProvider(['not json', '{"name":"bob","age":20}']);
    const result = await extractStructured({ provider, schema, messages: [] });
    expect(result).toEqual({ name: 'bob', age: 20 });
    expect(calls).toHaveLength(2);
  });

  it('校验失败时回填重试', async () => {
    const { provider } = mockProvider(['{"name":123,"age":"x"}', '{"name":"bob","age":20}']);
    const result = await extractStructured({ provider, schema, messages: [] });
    expect(result).toEqual({ name: 'bob', age: 20 });
  });

  it('超出重试上限抛错', async () => {
    const { provider } = mockProvider(['bad', 'bad', 'bad']);
    await expect(extractStructured({ provider, schema, messages: [] })).rejects.toThrow(
      /failed after 3 attempt/,
    );
  });
});
