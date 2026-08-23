/** 搜索结果（归一化）。 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** 搜索选项。 */
export interface SearchOptions {
  timeoutMs?: number;
  /** 站点过滤（站内搜索）。 */
  site?: string;
}

/** 搜索提供商接口（可插拔：duckduckgo / tavily / serpapi / searxng …）。 */
export interface SearchProvider {
  readonly name: string;
  search(query: string, opts?: SearchOptions): Promise<SearchResult[]>;
}
