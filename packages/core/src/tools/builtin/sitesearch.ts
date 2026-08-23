import { z } from 'zod';
import type { WebSearchPolicy } from '@agent-engine/config';
import type { Tool } from '../types';
import type { SearchProvider, SearchResult } from '../utils/search';

// ============ 类型 ============

/** sitesearch 入参。 */
export interface SiteSearchInput {
  query: string;
  site: string;
}

/** sitesearch 结果。 */
export interface SiteSearchResult {
  query: string;
  site: string;
  results: SearchResult[];
}

// ============ schema ============

const SiteSearchInputSchema = z.object({
  query: z.string().min(1),
  site: z.string().min(1),
});

// ============ 工具 ============

/** 创建 `sitesearch` 内置工具：复用 SearchProvider 并携带 site 过滤（站内搜索）。 */
export function createSiteSearchTool(
  provider: SearchProvider,
  policy: WebSearchPolicy,
): Tool<SiteSearchInput, SiteSearchResult> {
  return {
    name: 'builtin.sitesearch',
    description: 'Search within a specific site/domain and return structured results.',
    inputSchema: SiteSearchInputSchema,
    execute: async ({ query, site }) => {
      const results = await provider.search(query, { site, timeoutMs: policy.timeoutMs });
      return { query, site, results: results.slice(0, policy.maxResults) };
    },
  };
}
