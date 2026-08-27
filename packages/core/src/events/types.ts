/** 内核业务事件：模块生命周期与可观测事件（区别于 hooks 的生命周期锚点、区别于流式 `AgentRunEvent`）。 */
export type AgentEngineEvent =
  | { type: 'plugin.installed'; name: string }
  | { type: 'mcp.connected'; name: string }
  | { type: 'mcp.failed'; name: string; error: string }
  | { type: 'tool.registered'; name: string }
  /** 逃生舱：用户/插件自定义事件（`data` 原样透传，类型自行收窄）。 */
  | { type: 'custom'; name: string; data?: unknown };

export type EventListener = (event: AgentEngineEvent) => void;
