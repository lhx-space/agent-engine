/** 搜索结果（归一化）。 */
// ============ 类型 ============

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

/** 按 URL 去重（保留首次出现）。 */
// ============ 组合 ============

export function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    if (seen.has(result.url)) return false;
    seen.add(result.url);
    return true;
  });
}

/** 按 query 关键词命中数重排（title + snippet 命中越多越靠前）。 */
export function rankResults(results: SearchResult[], query: string): SearchResult[] {
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return results;
  const score = (result: SearchResult): number => {
    const text = `${result.title} ${result.snippet}`.toLowerCase();
    return keywords.reduce((acc, keyword) => acc + (text.includes(keyword) ? 1 : 0), 0);
  };
  return [...results].sort((a, b) => score(b) - score(a));
}

/** 组合多个 provider：逐个尝试，抛错或空结果则试下一个，全失败抛最后一个错误；命中结果去重 + 重排。 */
export function createFallbackSearchProvider(providers: SearchProvider[]): SearchProvider {
  return {
    name: `fallback(${providers.map((p) => p.name).join(',')})`,
    async search(query, opts) {
      let lastError: unknown = new Error('no search provider available');
      for (const provider of providers) {
        try {
          const results = await provider.search(query, opts);
          if (results.length > 0) {
            return rankResults(dedupeResults(results), query);
          }
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

/** 并行组合多个 provider：同时搜索，合并成功结果，去重 + 重排；全部失败抛最后一个错误。 */
export function createParallelSearchProvider(providers: SearchProvider[]): SearchProvider {
  return {
    name: `parallel(${providers.map((p) => p.name).join(',')})`,
    async search(query, opts) {
      const settled = await Promise.allSettled(
        providers.map((provider) => provider.search(query, opts)),
      );
      const results: SearchResult[] = [];
      let lastError: unknown = new Error('no search provider available');
      for (const item of settled) {
        if (item.status === 'fulfilled') {
          results.push(...item.value);
        } else {
          lastError = item.reason;
        }
      }
      if (results.length === 0) {
        throw lastError instanceof Error
          ? lastError
          : new Error(`search failed: ${String(lastError)}`);
      }
      return rankResults(dedupeResults(results), query);
    },
  };
}
