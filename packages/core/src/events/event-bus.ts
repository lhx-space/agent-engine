import type { AgentEngineEvent, EventListener } from './types';

/**
 * 事件总线：模块业务事件（plugin 已装 / mcp 已连 / 工具已注册 / 规则·技能已加载 / 自定义）
 * 的发布/订阅。监听器同步执行；`on` 返回取消函数。
 */
export class EventBus {
  private readonly listeners = new Set<EventListener>();

  /** 注册监听器，返回取消函数（幂等）。 */
  on(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** 同步通知全部监听器。 */
  emit(event: AgentEngineEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
