import { z } from 'zod';
import type { WebSearchPolicy } from '@agent-engine/config';
import type { Tool } from '../types';
import type { SearchProvider, SearchResult } from '../utils/search';

// ============ 类型 ============

/** web_search 入参。 */
export interface WebSearchInput {
  query: string;
}

/** web_search 结果。 */
export interface WebSearchResult {
  query: string;
  results: SearchResult[];
}

// ============ schema ============

const WebSearchInputSchema = z.object({ query: z.string().min(1) });

// ============ 工具 ============

/** 创建 `web_search` 内置工具：经可插拔 `SearchProvider` 搜索，返回结构化结果（受 `maxResults` 上限）。 */
export function createWebSearchTool(
  provider: SearchProvider,
  policy: WebSearchPolicy,
): Tool<WebSearchInput, WebSearchResult> {
  return {
    name: 'builtin.web_search',
    description: 'Search the web and return structured results (title / url / snippet).',
    inputSchema: WebSearchInputSchema,
    execute: async ({ query }) => {
      const results = await provider.search(query, { timeoutMs: policy.timeoutMs });
      return { query, results: results.slice(0, policy.maxResults) };
    },
  };
}
