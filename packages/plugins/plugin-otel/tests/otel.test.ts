import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Tracer } from '@opentelemetry/api';
import type { Hook } from '@lhx-agent-engine/core/hooks';
import { createOtelPlugin } from '../src/index';

const mocks = rs.hoisted(() => ({
  setAttribute: rs.fn(),
  recordException: rs.fn(),
  setStatus: rs.fn(),
  end: rs.fn(),
}));

/** 注入的 fake tracer：不加载真实 `@opentelemetry/api`（其 ESM 构建在 Node 下无法直接解析）。 */
function makeTracer(): Tracer {
  const span = {
    setAttribute: mocks.setAttribute,
    recordException: mocks.recordException,
    setStatus: mocks.setStatus,
    end: mocks.end,
  };
  return {
    startActiveSpan: (_name: string, fn: (s: unknown) => unknown) => fn(span),
  } as unknown as Tracer;
}

describe('createOtelPlugin', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('install 注册一个覆盖生命周期的 hook', async () => {
    const plugin = createOtelPlugin({ tracer: makeTracer() });
    const hooks: Hook[] = [];
    await plugin.install({ registerHook: (h: Hook) => hooks.push(h) } as never);

    expect(plugin.name).toBe('@lhx-agent-engine/plugin-otel');
    expect(hooks.length).toBe(1);
    expect(hooks[0].name).toBe('@lhx-agent-engine/plugin-otel');
    expect(hooks[0].beforeLLM).toBeTypeOf('function');
    expect(hooks[0].afterLLM).toBeTypeOf('function');
    expect(hooks[0].beforeToolCall).toBeTypeOf('function');
    expect(hooks[0].afterToolCall).toBeTypeOf('function');
    expect(hooks[0].onStepEnd).toBeTypeOf('function');
    expect(hooks[0].onError).toBeTypeOf('function');
  });

  it('hook 方法创建 span、设置属性并在结束时 end（不改写入参）', async () => {
    const plugin = createOtelPlugin({ tracer: makeTracer() });
    let hook: Hook | undefined;
    await plugin.install({
      registerHook: (h: Hook) => {
        hook = h;
      },
    } as never);

    await expect(hook!.beforeLLM!([{ role: 'user', content: 'hi' }])).resolves.toBeUndefined();
    expect(mocks.end).toHaveBeenCalled();
    expect(mocks.setAttribute).toHaveBeenCalledWith('agent.messages.count', 1);

    await expect(
      hook!.afterLLM!({ message: { role: 'assistant', content: 'ok' } }),
    ).resolves.toBeUndefined();

    await expect(hook!.beforeToolCall!('bash', '{}')).resolves.toBeUndefined();
    expect(mocks.setAttribute).toHaveBeenCalledWith('agent.tool.name', 'bash');

    await expect(hook!.afterToolCall!('bash', 'ok')).resolves.toBeUndefined();
    await expect(hook!.onStepEnd!(1)).resolves.toBeUndefined();
    expect(mocks.setAttribute).toHaveBeenCalledWith('agent.step.index', 1);
  });

  it('onError 记录异常并置 status=ERROR', async () => {
    const plugin = createOtelPlugin({ tracer: makeTracer() });
    let hook: Hook | undefined;
    await plugin.install({
      registerHook: (h: Hook) => {
        hook = h;
      },
    } as never);

    const error = new Error('boom');
    await hook!.onError!(error, 'agent-loop');

    expect(mocks.recordException).toHaveBeenCalledWith(error);
    expect(mocks.setStatus).toHaveBeenCalledWith({ code: 2, message: 'boom' });
  });
});
