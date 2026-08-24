import type { SecurityConfig, WebSearchProvider } from '@agent-engine/config';
import type { ToolRegistry } from '../registry';
import type { FetchLike } from '../utils/http';
import type { SearchProvider } from '../utils/search';
import { createFallbackSearchProvider } from '../utils/search';
import { createDuckDuckGoSearchProvider } from '../utils/duckduckgo';
import { createSearXNGSearchProvider } from '../utils/searxng';
import { createTavilySearchProvider } from '../utils/tavily';
import { createSerperSearchProvider } from '../utils/serper';
import { TodoStore } from '../utils/todo-store';
import { createDatetimeTool } from './datetime';
import { createTodoTool } from './todo';
import { createWebFetchTool } from './web-fetch';
import { createWebSearchTool } from './web-search';

// ============ 类型 ============

/** 内置工具装配依赖（可注入以便测试）。 */
export interface RegisterBuiltinToolsDeps {
  todoStore?: TodoStore;
  /** 预置搜索提供商；缺省时按 security.webSearch.provider 解析（searxng / duckduckgo / tavily / serper）。 */
  searchProvider?: SearchProvider;
  fetchImpl?: FetchLike;
}

// ============ utils re-export ============

export { type FetchLike, type FetchInit, type HttpResponse, defaultFetch } from '../utils/http';
export {
  type SearchProvider,
  type SearchResult,
  type SearchOptions,
  createFallbackSearchProvider,
} from '../utils/search';
export { createDuckDuckGoSearchProvider } from '../utils/duckduckgo';
export { createSearXNGSearchProvider } from '../utils/searxng';
export { createTavilySearchProvider } from '../utils/tavily';
export { createSerperSearchProvider } from '../utils/serper';
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

/** 按名解析单个搜索 provider；缺失必需配置（endpoint / apiKey）时返回 undefined（视为不可用）。 */
function buildSearchProvider(
  name: WebSearchProvider,
  security: SecurityConfig,
  deps: RegisterBuiltinToolsDeps,
): SearchProvider | undefined {
  const fetchImpl = deps.fetchImpl;
  switch (name) {
    case 'duckduckgo':
      return createDuckDuckGoSearchProvider(fetchImpl);
    case 'searxng': {
      const endpoint = security.webSearch.endpoint;
      return endpoint ? createSearXNGSearchProvider(endpoint, fetchImpl) : undefined;
    }
    case 'tavily': {
      const apiKey = security.webSearch.apiKey;
      return apiKey ? createTavilySearchProvider(apiKey, fetchImpl) : undefined;
    }
    case 'serper': {
      const apiKey = security.webSearch.apiKey;
      return apiKey ? createSerperSearchProvider(apiKey, fetchImpl) : undefined;
    }
  }
}

/**
 * 按 `security.webSearch.provider` 解析搜索提供商（预置 provider 优先）。
 * 主 provider 缺失必需配置时跳过并回退 `fallback`（默认 duckduckgo）；剩余候选用组合器在
 * 运行期失败/空结果时按序降级；无任何可用 provider 时抛可读错误。
 */
function resolveSearchProvider(
  security: SecurityConfig,
  deps: RegisterBuiltinToolsDeps,
): SearchProvider {
  if (deps.searchProvider) return deps.searchProvider;

  const candidates: SearchProvider[] = [];
  const primary = buildSearchProvider(security.webSearch.provider, security, deps);
  if (primary) candidates.push(primary);

  const fallback = buildSearchProvider(security.webSearch.fallback, security, deps);
  if (fallback && fallback.name !== primary?.name) candidates.push(fallback);

  if (candidates.length === 0) {
    throw new Error(
      `No search provider available: "${security.webSearch.provider}" lacks required config ` +
        `(searxng needs endpoint, tavily/serper need apiKey) and fallback ` +
        `"${security.webSearch.fallback}" is also unavailable`,
    );
  }
  return candidates.length === 1 ? candidates[0]! : createFallbackSearchProvider(candidates);
}

/**
 * 统一装配内置工具：只注册**通用原语** `todo` / `datetime` / `web_search` / `web_fetch`。
 * 垂直能力（read_file / write_file / bash）由内置 plugin（`@agent-engine/plugin-files` /
 * `@agent-engine/plugin-bash`）按 `config.plugins` 声明加载；`sitesearch` / `calculator` /
 * `json` / `base64` 已彻底移除（源码文件亦删除）。
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
