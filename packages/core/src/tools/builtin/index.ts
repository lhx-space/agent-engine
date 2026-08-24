import type { SecurityConfig } from '@agent-engine/config';
import type { ToolRegistry } from '../registry';
import type { FetchLike } from '../utils/http';
import type { SearchProvider } from '../utils/search';
import { createDuckDuckGoSearchProvider } from '../utils/duckduckgo';
import { TodoStore } from '../utils/todo-store';
import { createDatetimeTool } from './datetime';
import { createTodoTool } from './todo';
import { createWebFetchTool } from './web-fetch';
import { createWebSearchTool } from './web-search';

// ============ 类型 ============

/** 内置工具装配依赖（可注入以便测试）。 */
export interface RegisterBuiltinToolsDeps {
  todoStore?: TodoStore;
  /** 预置搜索提供商；缺省时按 security.webSearch.provider 解析（内置 duckduckgo）。 */
  searchProvider?: SearchProvider;
  fetchImpl?: FetchLike;
}

// ============ utils re-export ============

export { type FetchLike, type HttpResponse, defaultFetch } from '../utils/http';
export { type SearchProvider, type SearchResult, type SearchOptions } from '../utils/search';
export { createDuckDuckGoSearchProvider } from '../utils/duckduckgo';
export { resolveWithinRoot } from '../utils/path';
export { isDomainAllowed, type DomainPolicy } from '../utils/domain';
export { TodoStore, type TodoItem, type TodoStatus } from '../utils/todo-store';
export { checkBashPolicy } from '../utils/bash-policy';

// ============ 通用原语 tools re-export ============

export { createTodoTool, type TodoInput, type TodoResult, TODO_PLANNING_GUIDANCE } from './todo';
export { createWebSearchTool, type WebSearchInput, type WebSearchResult } from './web-search';
export { createWebFetchTool, type WebFetchInput, type WebFetchResult } from './web-fetch';
export { createDatetimeTool, type DatetimeInput, type DatetimeResult } from './datetime';

// ============ 装配 ============

/** 按 security.webSearch.provider 解析搜索提供商（内置 duckduckgo；预置 provider 优先）。 */
function resolveSearchProvider(
  security: SecurityConfig,
  deps: RegisterBuiltinToolsDeps,
): SearchProvider {
  if (deps.searchProvider) return deps.searchProvider;
  const name = security.webSearch.provider;
  if (name === 'duckduckgo') return createDuckDuckGoSearchProvider(deps.fetchImpl);
  throw new Error(`Unknown search provider "${name}" (built-in: duckduckgo)`);
}

/**
 * 统一装配内置工具：只注册**通用原语** `todo` / `datetime` / `web_search` / `web_fetch`。
 * 垂直能力（read_file / write_file / bash）由内置 plugin（`@agent-engine/plugin-files` /
 * `@agent-engine/plugin-bash`）按 `config.plugins` 声明加载；`sitesearch` / `calculator` /
 * `json` / `base64` 已移除（实现保留在 `tools/builtin/` 供 plugin 复用）。
 */
export function registerBuiltinTools(
  registry: ToolRegistry,
  security: SecurityConfig,
  deps: RegisterBuiltinToolsDeps = {},
): string[] {
  const registered: string[] = [];

  // todo 是任务规划原语（AGENTS.md 6.2），始终注册。
  registry.register(createTodoTool(deps.todoStore ?? new TodoStore()));
  registered.push('builtin.todo');

  registry.register(createDatetimeTool());
  registered.push('builtin.datetime');

  registry.register(createWebSearchTool(resolveSearchProvider(security, deps), security.webSearch));
  registered.push('builtin.web_search');

  registry.register(createWebFetchTool(security.webFetch, deps.fetchImpl));
  registered.push('builtin.web_fetch');

  return registered;
}
