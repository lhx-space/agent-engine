import { defaultFetch } from '@lhx-agent-engine/core';
import type { FetchLike } from '@lhx-agent-engine/core';
import type { SearchProvider, SearchResult } from './search';

// 浏览器 UA 伪装：DDG 对非浏览器 UA 会风控（403 / 202 空结果）。
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

interface CacheEntry {
  results: SearchResult[];
  expiresAt: number;
}

export interface DuckDuckGoOptions {
  /** 失败重试次数（指数退避），默认 2。 */
  maxRetries?: number;
  /** 相同 query 的缓存 TTL（毫秒），默认 60s。 */
  cacheTtlMs?: number;
}

/** DuckDuckGo Instant Answer（keyless JSON）搜索后端：UA 伪装 + 指数退避重试 + query 缓存。 */
export function createDuckDuckGoSearchProvider(
  fetchImpl: FetchLike = defaultFetch,
  options: DuckDuckGoOptions = {},
): SearchProvider {
  const maxRetries = options.maxRetries ?? 2;
  const cacheTtlMs = options.cacheTtlMs ?? 60_000;
  const cache = new Map<string, CacheEntry>();

  async function searchOnce(query: string, timeoutMs: number): Promise<SearchResult[]> {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(
      query,
    )}&format=json&no_html=1&skip_disambig=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        signal: controller.signal,
        headers: { 'user-agent': BROWSER_UA },
      });
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
  }

  return {
    name: 'duckduckgo',
    async search(query, opts) {
      const timeoutMs = opts?.timeoutMs ?? 10_000;

      // 缓存：相同 query 命中直接返回（缓解风控 + 去重）。
      const cached = cache.get(query);
      if (cached) {
        if (cached.expiresAt > Date.now()) return cached.results;
        cache.delete(query);
      }

      // 指数退避重试。
      let lastError: unknown;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          const results = await searchOnce(query, timeoutMs);
          cache.set(query, { results, expiresAt: Date.now() + cacheTtlMs });
          return results;
        } catch (error) {
          lastError = error;
          if (attempt < maxRetries) await sleep(500 * 2 ** attempt);
        }
      }
      throw lastError instanceof Error ? lastError : new Error(String(lastError));
    },
  };
}
