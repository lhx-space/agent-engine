import type { ChatCompletionResult, ChatMessage } from '../llm/types';
import type { Hook, HookPoint, HookTrace } from './types';

/**
 * Hook 管线：管理多个 hook，按注册顺序对每个钩子点链式执行——
 * 前一 hook 的返回值作为后一 hook 的入参，返回 void 则保持原值。
 * 每次 hook 执行产出 `HookTrace`（可观测），经 `onTrace` 监听器通知调用方。
 */
export class HookPipeline {
  private readonly hooks: Hook[] = [];
  private readonly listeners: ((trace: HookTrace) => void)[] = [];

  register(hook: Hook): void {
    this.hooks.push(hook);
  }

  /** 注册 trace 监听器（返回取消函数）。 */
  onTrace(listener: (trace: HookTrace) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  /** 对某个钩子点执行单个 hook，记录耗时与是否改写，并通知 trace 监听器。 */
  private async invoke<T>(
    point: HookPoint,
    hook: Hook,
    fn: (hook: Hook) => Promise<T | void> | undefined,
    current: T,
    equal: (a: T, b: T) => boolean,
  ): Promise<T> {
    const start = performance.now();
    const next = await fn(hook);
    const durationMs = performance.now() - start;
    const changed = next !== undefined && !equal(current, next);
    for (const listener of this.listeners) {
      listener({ hook: hook.name, point, durationMs, changed });
    }
    return changed ? (next as T) : current;
  }

  async beforeLLM(messages: ChatMessage[]): Promise<ChatMessage[]> {
    let current = messages;
    for (const hook of this.hooks) {
      current = await this.invoke(
        'beforeLLM',
        hook,
        (h) => h.beforeLLM?.(current),
        current,
        (a, b) => a === b,
      );
    }
    return current;
  }

  async afterLLM(result: ChatCompletionResult): Promise<ChatCompletionResult> {
    let current = result;
    for (const hook of this.hooks) {
      current = await this.invoke(
        'afterLLM',
        hook,
        (h) => h.afterLLM?.(current),
        current,
        (a, b) => a === b,
      );
    }
    return current;
  }

  async beforeToolCall(name: string, args: string): Promise<string> {
    let current = args;
    for (const hook of this.hooks) {
      current = await this.invoke(
        'beforeToolCall',
        hook,
        (h) => h.beforeToolCall?.(name, current),
        current,
        (a, b) => a === b,
      );
    }
    return current;
  }

  async afterToolCall(name: string, result: string): Promise<string> {
    let current = result;
    for (const hook of this.hooks) {
      current = await this.invoke(
        'afterToolCall',
        hook,
        (h) => h.afterToolCall?.(name, current),
        current,
        (a, b) => a === b,
      );
    }
    return current;
  }

  async onStepEnd(step: number): Promise<void> {
    for (const hook of this.hooks) {
      await this.invoke(
        'onStepEnd',
        hook,
        (h) => h.onStepEnd?.(step),
        undefined,
        () => true,
      );
    }
  }

  async onError(error: Error, phase: string): Promise<void> {
    for (const hook of this.hooks) {
      await this.invoke(
        'onError',
        hook,
        (h) => h.onError?.(error, phase),
        undefined,
        () => true,
      );
    }
  }
}
