import { defaultFetch } from './http';
import type { FetchLike } from './http';
import type { SearchProvider, SearchResult } from './search';

interface DuckDuckGoTopic {
  Text?: string;
  FirstURL?: string;
  Topics?: DuckDuckGoTopic[];
}

interface DuckDuckGoResponse {
  AbstractText?: string;
  AbstractURL?: string;
  Heading?: string;
  RelatedTopics?: DuckDuckGoTopic[];
}

function flattenRelatedTopics(topics: DuckDuckGoTopic[] | undefined, out: SearchResult[]): void {
  if (!topics) return;
  for (const topic of topics) {
    if (topic.Topics && topic.Topics.length > 0) {
      flattenRelatedTopics(topic.Topics, out);
    } else if (topic.FirstURL) {
      out.push({ title: topic.Text ?? '', url: topic.FirstURL, snippet: topic.Text ?? '' });
    }
  }
}

/** DuckDuckGo Instant Answer（keyless JSON）搜索后端；`site` 过滤走 `site:` 语法。 */
export function createDuckDuckGoSearchProvider(
  fetchImpl: FetchLike = defaultFetch,
): SearchProvider {
  return {
    name: 'duckduckgo',
    async search(query, opts) {
      const q = opts?.site ? `${query} site:${opts.site}` : query;
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(
        q,
      )}&format=json&no_html=1&skip_disambig=1`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 10_000);
      try {
        const response = await fetchImpl(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`DuckDuckGo search failed: HTTP ${response.status}`);
        }
        const data = (await response.json()) as DuckDuckGoResponse;

        const results: SearchResult[] = [];
        if (data.AbstractText) {
          results.push({
            title: data.Heading ?? '',
            url: data.AbstractURL ?? '',
            snippet: data.AbstractText,
          });
        }
        flattenRelatedTopics(data.RelatedTopics, results);
        return results;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
