import { describe, expect, it } from 'vitest';
import { HookPipeline } from '../src/hooks/pipeline';

describe('HookPipeline', () => {
  it('多 hook 链式执行，返回值传递', async () => {
    const pipeline = new HookPipeline();
    pipeline.register({
      name: 'a',
      beforeLLM: async (messages) => [...messages, { role: 'user', content: 'from-a' }],
    });
    pipeline.register({
      name: 'b',
      beforeLLM: async (messages) => [...messages, { role: 'user', content: 'from-b' }],
    });

    const result = await pipeline.beforeLLM([{ role: 'system', content: 's' }]);

    expect(result).toHaveLength(3);
    expect(result[2]?.content).toBe('from-b');
  });

  it('返回 void 保持原值', async () => {
    const pipeline = new HookPipeline();
    pipeline.register({ name: 'noop', beforeLLM: async () => undefined });
    pipeline.register({
      name: 'add',
      beforeLLM: async (messages) => [...messages, { role: 'user', content: 'x' }],
    });

    const result = await pipeline.beforeLLM([{ role: 'system', content: 's' }]);

    expect(result).toHaveLength(2);
    expect(result[1]?.content).toBe('x');
  });

  it('beforeToolCall 可改写参数', async () => {
    const pipeline = new HookPipeline();
    pipeline.register({
      name: 'sanitize',
      beforeToolCall: async (_name, args) => args.replace('secret', '***'),
    });

    const result = await pipeline.beforeToolCall('bash', 'echo secret');

    expect(result).toBe('echo ***');
  });

  it('afterToolCall 可改写结果', async () => {
    const pipeline = new HookPipeline();
    pipeline.register({
      name: 'redact',
      afterToolCall: async (_name, result) => result.replace(/secret/g, '***'),
    });

    const result = await pipeline.afterToolCall('read_file', 'file contains secret');

    expect(result).toBe('file contains ***');
  });

  it('onStepEnd 观察类按注册顺序调用', async () => {
    const pipeline = new HookPipeline();
    const order: string[] = [];
    pipeline.register({
      name: 'a',
      onStepEnd: async () => {
        order.push('a');
      },
    });
    pipeline.register({
      name: 'b',
      onStepEnd: async () => {
        order.push('b');
      },
    });

    await pipeline.onStepEnd(1);

    expect(order).toEqual(['a', 'b']);
  });
});
