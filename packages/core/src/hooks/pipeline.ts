import type { ChatCompletionResult, ChatMessage } from '../llm/types';
import type { Hook } from './types';

/**
 * Hook 管线：管理多个 hook，按注册顺序对每个钩子点链式执行——
 * 前一 hook 的返回值作为后一 hook 的入参，返回 void 则保持原值。
 */
export class HookPipeline {
  private readonly hooks: Hook[] = [];

  register(hook: Hook): void {
    this.hooks.push(hook);
  }

  async beforeLLM(messages: ChatMessage[]): Promise<ChatMessage[]> {
    let current = messages;
    for (const hook of this.hooks) {
      const next = await hook.beforeLLM?.(current);
      current = next ?? current;
    }
    return current;
  }

  async afterLLM(result: ChatCompletionResult): Promise<ChatCompletionResult> {
    let current = result;
    for (const hook of this.hooks) {
      const next = await hook.afterLLM?.(current);
      current = next ?? current;
    }
    return current;
  }

  async beforeToolCall(name: string, args: string): Promise<string> {
    let current = args;
    for (const hook of this.hooks) {
      const next = await hook.beforeToolCall?.(name, current);
      current = next ?? current;
    }
    return current;
  }

  async afterToolCall(name: string, result: string): Promise<string> {
    let current = result;
    for (const hook of this.hooks) {
      const next = await hook.afterToolCall?.(name, current);
      current = next ?? current;
    }
    return current;
  }

  async onStepEnd(step: number): Promise<void> {
    for (const hook of this.hooks) {
      await hook.onStepEnd?.(step);
    }
  }

  async onError(error: Error, phase: string): Promise<void> {
    for (const hook of this.hooks) {
      await hook.onError?.(error, phase);
    }
  }
}
