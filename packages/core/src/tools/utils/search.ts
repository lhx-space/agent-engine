/** 搜索结果（归一化）。 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** 搜索选项。 */
export interface SearchOptions {
  timeoutMs?: number;
  /** 期望返回条数上限（provider 可据此限制请求，最终由工具层再截断）。 */
  maxResults?: number;
}

/** 搜索提供商接口（可插拔：searxng / duckduckgo / tavily / serper …）。 */
export interface SearchProvider {
  readonly name: string;
  search(query: string, opts?: SearchOptions): Promise<SearchResult[]>;
}

/** 组合多个 provider：逐个尝试，抛错或空结果则试下一个，全失败抛最后一个错误。 */
export function createFallbackSearchProvider(providers: SearchProvider[]): SearchProvider {
  return {
    name: `fallback(${providers.map((p) => p.name).join(',')})`,
    async search(query, opts) {
      let lastError: unknown = new Error('no search provider available');
      for (const provider of providers) {
        try {
          const results = await provider.search(query, opts);
          if (results.length > 0) return results;
          lastError = new Error(`search provider "${provider.name}" returned empty results`);
        } catch (err) {
          lastError = err;
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error(`search failed: ${String(lastError)}`);
    },
  };
}
