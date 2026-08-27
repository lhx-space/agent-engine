import { defaultFetch } from '@agent-engine/core';
import type { FetchLike } from '@agent-engine/core';
import type { SearchProvider, SearchResult } from './search';

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

/** Tavily 搜索（POST，需 API key，`Authorization: Bearer`）。 */
export function createTavilySearchProvider(
  apiKey: string,
  fetchImpl: FetchLike = defaultFetch,
): SearchProvider {
  return {
    name: 'tavily',
    async search(query, opts) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 10_000);
      try {
        const response = await fetchImpl('https://api.tavily.com/search', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query,
            max_results: opts?.maxResults ?? 10,
            search_depth: 'basic',
          }),
        });
        if (!response.ok) {
          throw new Error(`Tavily search failed: HTTP ${response.status}`);
        }
        const data = (await response.json()) as TavilyResponse;
        return (data.results ?? []).map((r): SearchResult => ({
          title: r.title ?? '',
          url: r.url ?? '',
          snippet: r.content ?? '',
        }));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
