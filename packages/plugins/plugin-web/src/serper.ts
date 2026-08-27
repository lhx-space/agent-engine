import { defaultFetch } from '@agent-engine/core';
import type { FetchLike } from '@agent-engine/core';
import type { SearchProvider, SearchResult } from './search';

interface SerperOrganic {
  title?: string;
  link?: string;
  snippet?: string;
}

interface SerperResponse {
  organic?: SerperOrganic[];
}

/** Serper（Google Search，POST，需 API key，`X-API-KEY` header）。 */
export function createSerperSearchProvider(
  apiKey: string,
  fetchImpl: FetchLike = defaultFetch,
): SearchProvider {
  return {
    name: 'serper',
    async search(query, opts) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 10_000);
      try {
        const response = await fetchImpl('https://google.serper.dev/search', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({ q: query, num: opts?.maxResults ?? 10 }),
        });
        if (!response.ok) {
          throw new Error(`Serper search failed: HTTP ${response.status}`);
        }
        const data = (await response.json()) as SerperResponse;
        return (data.organic ?? []).map((r): SearchResult => ({
          title: r.title ?? '',
          url: r.link ?? '',
          snippet: r.snippet ?? '',
        }));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
