import type { ToolRegistry } from '../registry';
import { TodoStore } from '../utils/todo-store';
import { createDatetimeTool } from './datetime';
import { createTodoTool } from './todo';

// ============ 类型 ============

/** 内置工具装配依赖（可注入以便测试）。 */
export interface RegisterBuiltinToolsDeps {
  todoStore?: TodoStore;
}

// ============ utils re-export ============

export { type FetchLike, type FetchInit, type HttpResponse, defaultFetch } from '../utils/http';
export { resolveWithinRoot } from '../utils/path';
export { TodoStore, type TodoItem, type TodoStatus } from '../utils/todo-store';
export { checkBashPolicy } from '../utils/bash-policy';

// ============ 通用原语 tools re-export ============

export { createTodoTool, type TodoInput, type TodoResult, TODO_PLANNING_GUIDANCE } from './todo';
export { createDatetimeTool, type DatetimeInput, type DatetimeResult } from './datetime';

// ============ 装配 ============

/**
 * 统一装配内置工具：只注册**通用原语** `todo` / `datetime`。
 * 垂直能力（read_file / write_file / bash）由内置 plugin（`@lhx-agent-engine/plugin-files` /
 * `@lhx-agent-engine/plugin-bash`）按 `config.plugins` 声明加载；`web_search` / `web_fetch`
 * 已外放为 `@lhx-agent-engine/plugin-web`。
 */
export function registerBuiltinTools(
  registry: ToolRegistry,
  deps: RegisterBuiltinToolsDeps = {},
): string[] {
  const registered: string[] = [];

  // todo 是任务规划原语（AGENTS.md 6.2），始终注册。
  registry.register(createTodoTool(deps.todoStore ?? new TodoStore()));
  registered.push('builtin.todo');

  registry.register(createDatetimeTool());
  registered.push('builtin.datetime');

  return registered;
}
