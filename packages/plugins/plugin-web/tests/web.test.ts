import { describe, expect, it } from '@rstest/core';
import type { SecurityConfig, WebPolicy, WebSearchPolicy } from '@agent-engine/config';
import type { FetchLike, HttpResponse } from '@agent-engine/core';
import type { PluginContext, Tool } from '@agent-engine/core';
import {
  createDuckDuckGoSearchProvider,
  createFallbackSearchProvider,
  createSearXNGSearchProvider,
  createWebFetchTool,
  createWebPlugin,
  createWebSearchTool,
} from '../src/index';
import type { SearchProvider } from '../src/index';

function fakeResponse(overrides: Partial<HttpResponse> = {}): HttpResponse {
  return {
    ok: true,
    status: 200,
    contentType: 'text/html',
    text: async () => '',
    json: async () => ({}),
    ...overrides,
  };
}

function makeSecurity(): SecurityConfig {
  return {
    sandbox: { backend: 'auto', image: 'agent-engine/sandbox' },
    bash: {
      enabled: false,
      allowCommands: [],
      denyPatterns: [],
      allowNetwork: false,
      timeoutMs: 1000,
      maxOutputBytes: 1024,
    },
    files: { roots: [], maxFileBytes: 1024 },
    webSearch: { provider: 'searxng', fallback: 'duckduckgo', maxResults: 8, timeoutMs: 1000 },
    webFetch: { allowDomains: [], denyDomains: [], timeoutMs: 1000, maxOutputBytes: 1024 },
  };
}

function makeCtx(): { ctx: PluginContext; tools: Tool[] } {
  const tools: Tool[] = [];
  const ctx = {
    registerTool: (tool: Tool) => tools.push(tool),
  } as PluginContext;
  return { ctx, tools };
}

describe('web_search（SearchProvider）', () => {
  it('返回结构化结果', async () => {
    const provider: SearchProvider = {
      name: 'fake',
      async search(query) {
        return [{ title: `t-${query}`, url: `https://e.com/${query}`, snippet: `s-${query}` }];
      },
    };
    const policy: WebSearchPolicy = {
      provider: 'duckduckgo',
      fallback: 'duckduckgo',
      maxResults: 8,
      timeoutMs: 1000,
    };
    const tool = createWebSearchTool(provider, policy);
    const res = (await tool.execute({ query: 'hello' })) as { results: { title: string }[] };
    expect(res.results[0]?.title).toBe('t-hello');
  });

  it('maxResults 截断', async () => {
    const provider: SearchProvider = {
      name: 'many',
      async search() {
        return Array.from({ length: 10 }, (_, i) => ({
          title: `t${i}`,
          url: `https://e.com/${i}`,
          snippet: `s${i}`,
        }));
      },
    };
    const policy: WebSearchPolicy = {
      provider: 'duckduckgo',
      fallback: 'duckduckgo',
      maxResults: 3,
      timeoutMs: 1000,
    };
    const tool = createWebSearchTool(provider, policy);
    const res = (await tool.execute({ query: 'x' })) as { results: unknown[] };
    expect(res.results).toHaveLength(3);
  });
});

describe('DuckDuckGo provider', () => {
  it('flatten AbstractText + RelatedTopics', async () => {
    const fakeFetch: FetchLike = async () =>
      fakeResponse({
        contentType: 'application/json',
        json: async () => ({
          AbstractText: 'instant answer',
          AbstractURL: 'https://ddg.com/abstract',
          Heading: 'Heading',
          RelatedTopics: [
            { Text: 'topic1', FirstURL: 'https://ddg.com/t1' },
            { Name: 'cat', Topics: [{ Text: 'topic2', FirstURL: 'https://ddg.com/t2' }] },
          ],
        }),
      });
    const provider = createDuckDuckGoSearchProvider(fakeFetch);
    const results = await provider.search('q');
    expect(results).toHaveLength(3);
    expect(results[0]?.title).toBe('Heading');
    expect(results[2]?.title).toBe('topic2');
  });
});

describe('SearXNG provider', () => {
  it('flatten results（content → snippet）', async () => {
    const fakeFetch: FetchLike = async () =>
      fakeResponse({
        contentType: 'application/json',
        json: async () => ({
          results: [
            { title: 'r1', url: 'https://e.com/1', content: 'snippet1', engine: 'google' },
            { title: 'r2', url: 'https://e.com/2', content: 'snippet2' },
          ],
        }),
      });
    const provider = createSearXNGSearchProvider('http://localhost:8080', fakeFetch);
    const results = await provider.search('hello');
    expect(results).toHaveLength(2);
    expect(results[0]?.snippet).toBe('snippet1');
  });
});

describe('fallback search provider', () => {
  it('主 provider 失败/空结果回退，全失败抛错', async () => {
    const primary: SearchProvider = {
      name: 'primary',
      async search() {
        throw new Error('primary down');
      },
    };
    const fallback: SearchProvider = {
      name: 'fallback',
      async search(query) {
        return [{ title: `fb-${query}`, url: 'https://e.com/fb', snippet: 's' }];
      },
    };
    const provider = createFallbackSearchProvider([primary, fallback]);
    const results = await provider.search('q');
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('fb-q');
  });
});

describe('createWebPlugin', () => {
  it('安装注册 web_search / web_fetch', async () => {
    const { ctx, tools } = makeCtx();
    await createWebPlugin(makeSecurity(), {
      fetchImpl: async () => fakeResponse(),
    }).install(ctx);

    expect(tools.map((t) => t.name)).toEqual(['builtin.web_search', 'builtin.web_fetch']);
  });

  it('tavily 无 apiKey 且无可用回退时报错', () => {
    const security: SecurityConfig = {
      ...makeSecurity(),
      webSearch: { provider: 'tavily', fallback: 'tavily', maxResults: 8, timeoutMs: 1000 },
    };
    expect(() => createWebPlugin(security).install(makeCtx().ctx)).toThrow(
      /No search provider available/,
    );
  });
});

describe('web_fetch 正文提取', () => {
  it('提取正文文本', async () => {
    const html =
      '<html><head><title>Page</title></head><body><article><h1>Title</h1><p>Hello world content here.</p></article></body></html>';
    const fakeFetch: FetchLike = async () => fakeResponse({ text: async () => html });
    const policy: WebPolicy = {
      allowDomains: ['example.com'],
      denyDomains: [],
      timeoutMs: 1000,
      maxOutputBytes: 10_000,
    };
    const tool = createWebFetchTool(policy, fakeFetch);
    const res = (await tool.execute({ url: 'https://example.com/page' })) as {
      content: string;
    };
    expect(res.content).toContain('Hello world content here');
  });

  it('拒绝域拦截且不发起请求', async () => {
    const policy: WebPolicy = {
      allowDomains: [],
      denyDomains: ['evil.com'],
      timeoutMs: 1000,
      maxOutputBytes: 100,
    };
    let called = false;
    const fakeFetch: FetchLike = async () => {
      called = true;
      return fakeResponse();
    };
    const tool = createWebFetchTool(policy, fakeFetch);
    await expect(tool.execute({ url: 'https://evil.com/x' })).rejects.toThrow(/not allowed/);
    expect(called).toBe(false);
  });
});
