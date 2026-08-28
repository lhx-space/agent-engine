import { defaultFetch } from '@lhx-agent-engine/core';
import type { FetchLike } from '@lhx-agent-engine/core';
import type { SearchProvider, SearchResult } from './search';

interface SearXNGResult {
  title?: string;
  url?: string;
  content?: string;
}

interface SearXNGResponse {
  results?: SearXNGResult[];
}

/** SearXNG metasearch（自建，keyless）JSON API：`GET {endpoint}/search?q=..&format=json`。 */
export function createSearXNGSearchProvider(
  endpoint: string,
  fetchImpl: FetchLike = defaultFetch,
): SearchProvider {
  const base = endpoint.replace(/\/+$/, '');
  return {
    name: 'searxng',
    async search(query, opts) {
      const url = `${base}/search?q=${encodeURIComponent(query)}&format=json`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 10_000);
      try {
        const response = await fetchImpl(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`SearXNG search failed: HTTP ${response.status}`);
        }
        const data = (await response.json()) as SearXNGResponse;
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
