import type { SecurityConfig, WebSearchProvider } from '@lhx-agent-engine/config';
import type { FetchLike } from '@lhx-agent-engine/core';
import type { Plugin } from '@lhx-agent-engine/core/plugins';
import { createDuckDuckGoSearchProvider } from './duckduckgo';
import type { SearchProvider } from './search';
import { createFallbackSearchProvider } from './search';
import { createSearXNGSearchProvider } from './searxng';
import { createSerperSearchProvider } from './serper';
import { createTavilySearchProvider } from './tavily';
import { createWebFetchTool } from './web-fetch';
import { createWebSearchTool } from './web-search';

// ============ re-export ============

export { createWebSearchTool, type WebSearchInput, type WebSearchResult } from './web-search';
export { createWebFetchTool, type WebFetchInput, type WebFetchResult } from './web-fetch';
export {
  type SearchProvider,
  type SearchResult,
  type SearchOptions,
  createFallbackSearchProvider,
} from './search';
export { createDuckDuckGoSearchProvider } from './duckduckgo';
export { createSearXNGSearchProvider } from './searxng';
export { createTavilySearchProvider } from './tavily';
export { createSerperSearchProvider } from './serper';
export { isDomainAllowed, type DomainPolicy } from './domain';

// ============ 类型 ============

/** plugin-web 工厂依赖（可注入以便测试）。 */
export interface WebPluginDeps {
  /** 预置搜索提供商；缺省时按 security.webSearch.provider 解析。 */
  searchProvider?: SearchProvider;
  fetchImpl?: FetchLike;
}

// ============ 装配 ============

/** 按名解析单个搜索 provider；缺失必需配置（endpoint / apiKey）时返回 undefined（视为不可用）。 */
function buildSearchProvider(
  name: WebSearchProvider,
  security: SecurityConfig,
  deps: WebPluginDeps,
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

/** 按 `security.webSearch` 解析搜索提供商（预置 provider 优先，回退 fallback）。 */
function resolveSearchProvider(security: SecurityConfig, deps: WebPluginDeps): SearchProvider {
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
 * 创建 web 工具插件：注册 `web_search`（可插拔 SearchProvider）与 `web_fetch`（domain 约束 + 正文提取）。
 * `security.webSearch` / `security.webFetch` 的解释权移交本插件（D1-A：字段不变、零迁移）。
 */
export function createWebPlugin(security: SecurityConfig, deps: WebPluginDeps = {}): Plugin {
  return {
    name: '@lhx-agent-engine/plugin-web',
    description: 'Web 工具（web_search / web_fetch）',
    version: '0.1.0',
    tags: ['web', 'search', 'fetch'],
    install(ctx) {
      ctx.registerTool(
        createWebSearchTool(resolveSearchProvider(security, deps), security.webSearch),
      );
      ctx.registerTool(createWebFetchTool(security.webFetch, deps.fetchImpl));
    },
  };
}
