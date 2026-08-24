import { describe, expect, it } from '@rstest/core';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  BashPolicy,
  FilePolicy,
  SecurityConfig,
  WebPolicy,
  WebSearchPolicy,
} from '@agent-engine/config';
import type { SandboxBackend, SandboxExecResult } from '../src/sandbox/types';
import { ToolRegistry } from '../src/tools/registry';
import { createBashTool } from '../src/tools/builtin/bash';
import { createDatetimeTool } from '../src/tools/builtin/datetime';
import { createReadFileTool, createWriteFileTool } from '../src/tools/builtin/file';
import { createTodoTool, TodoStore } from '../src/tools/builtin/todo';
import type { TodoItem } from '../src/tools/builtin/todo';
import { createWebFetchTool } from '../src/tools/builtin/web-fetch';
import { createWebSearchTool } from '../src/tools/builtin/web-search';
import { createDuckDuckGoSearchProvider } from '../src/tools/utils/duckduckgo';
import { createSearXNGSearchProvider } from '../src/tools/utils/searxng';
import type { FetchLike, HttpResponse } from '../src/tools/utils/http';
import { createFallbackSearchProvider } from '../src/tools/utils/search';
import type { SearchProvider } from '../src/tools/utils/search';
import { registerBuiltinTools } from '../src/tools/builtin';

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-engine-'));
  try {
    await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

const fakeSandbox: SandboxBackend = {
  kind: 'docker',
  exec: async (req) => ({
    exitCode: 0,
    stdout: JSON.stringify(req),
    stderr: '',
    truncated: false,
  }),
};

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

function makeBashPolicy(overrides: Partial<BashPolicy> = {}): BashPolicy {
  return {
    enabled: true,
    allowCommands: [],
    denyPatterns: [],
    allowNetwork: false,
    timeoutMs: 1000,
    maxOutputBytes: 1024,
    ...overrides,
  };
}

function makeSecurity(bashEnabled = false): SecurityConfig {
  return {
    sandbox: { backend: 'auto', image: 'agent-engine/sandbox' },
    bash: {
      enabled: bashEnabled,
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

describe('TodoStore / createTodoTool', () => {
  it('add / list / update / delete 流转', async () => {
    const store = new TodoStore();
    const tool = createTodoTool(store);

    const added = (await tool.execute({ action: 'add', task: 'write tests' })) as {
      item: TodoItem;
    };
    expect(added.item.status).toBe('pending');
    expect(added.item.id).toMatch(/^todo_/);

    const listed = (await tool.execute({ action: 'list' })) as { items: TodoItem[] };
    expect(listed.items).toHaveLength(1);

    await tool.execute({ action: 'update', id: added.item.id, status: 'completed' });
    const updated = (await tool.execute({ action: 'list' })) as { items: TodoItem[] };
    expect(updated.items[0]?.status).toBe('completed');

    await tool.execute({ action: 'delete', id: added.item.id });
    const after = (await tool.execute({ action: 'list' })) as { items: TodoItem[] };
    expect(after.items).toHaveLength(0);
  });

  it('add 缺 task 报错', async () => {
    const tool = createTodoTool(new TodoStore());
    await expect(tool.execute({ action: 'add' })).rejects.toThrow(/requires "task"/);
  });

  it('更新/删除不存在的 id 报错', async () => {
    const tool = createTodoTool(new TodoStore());
    await expect(tool.execute({ action: 'update', id: 'nope' })).rejects.toThrow(/not found/);
    await expect(tool.execute({ action: 'delete', id: 'nope' })).rejects.toThrow(/not found/);
  });
});

describe('文件路径约束', () => {
  it('根内读取成功', async () => {
    await withTempDir(async (dir) => {
      await fs.writeFile(path.join(dir, 'a.txt'), 'hello');
      const tool = createReadFileTool({ roots: [dir], maxFileBytes: 1024 });
      const res = (await tool.execute({ path: path.join(dir, 'a.txt') })) as { content: string };
      expect(res.content).toBe('hello');
    });
  });

  it('根外路径拒绝', async () => {
    await withTempDir(async (dir) => {
      await withTempDir(async (outside) => {
        await fs.writeFile(path.join(outside, 'b.txt'), 'secret');
        const tool = createReadFileTool({ roots: [dir], maxFileBytes: 1024 });
        await expect(tool.execute({ path: path.join(outside, 'b.txt') })).rejects.toThrow(
          /outside allowed roots/,
        );
      });
    });
  });

  it('symlink 逃逸拒绝', async () => {
    await withTempDir(async (dir) => {
      await withTempDir(async (outside) => {
        await fs.writeFile(path.join(outside, 'secret.txt'), 'secret');
        const link = path.join(dir, 'link.txt');
        await fs.symlink(path.join(outside, 'secret.txt'), link);
        const tool = createReadFileTool({ roots: [dir], maxFileBytes: 1024 });
        await expect(tool.execute({ path: link })).rejects.toThrow(/outside allowed roots/);
      });
    });
  });

  it('根内写入成功、根外写入拒绝', async () => {
    await withTempDir(async (dir) => {
      const tool = createWriteFileTool({ roots: [dir], maxFileBytes: 1024 });
      const res = (await tool.execute({
        path: path.join(dir, 'out.txt'),
        content: 'data',
      })) as { bytes: number };
      expect(res.bytes).toBe(4);
      expect(await fs.readFile(path.join(dir, 'out.txt'), 'utf8')).toBe('data');
    });
    await withTempDir(async (dir) => {
      await withTempDir(async (outside) => {
        const tool = createWriteFileTool({ roots: [dir], maxFileBytes: 1024 });
        await expect(
          tool.execute({ path: path.join(outside, 'x.txt'), content: 'x' }),
        ).rejects.toThrow(/outside allowed roots/);
      });
    });
  });
});

describe('bash 策略', () => {
  it('黑名单命中拒绝', async () => {
    const tool = createBashTool(makeBashPolicy({ denyPatterns: ['rm -rf'] }), fakeSandbox);
    await expect(tool.execute({ command: 'rm', args: ['-rf', '/'] })).rejects.toThrow(
      /deny pattern/,
    );
  });

  it('白名单放行', async () => {
    const tool = createBashTool(makeBashPolicy({ allowCommands: ['ls'] }), fakeSandbox);
    const res = (await tool.execute({ command: 'ls', args: [] })) as SandboxExecResult;
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('ls');
  });

  it('白名单未命中拒绝', async () => {
    const tool = createBashTool(makeBashPolicy({ allowCommands: ['ls'] }), fakeSandbox);
    await expect(tool.execute({ command: 'rm', args: [] })).rejects.toThrow(/not in allowCommands/);
  });

  it('enabled=false 拒绝', async () => {
    const tool = createBashTool(makeBashPolicy({ enabled: false }), fakeSandbox);
    await expect(tool.execute({ command: 'ls', args: [] })).rejects.toThrow(/disabled/);
  });
});

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
    const res = (await tool.execute({ query: 'hello' })) as {
      query: string;
      results: { title: string; url: string; snippet: string }[];
    };
    expect(res.query).toBe('hello');
    expect(res.results).toHaveLength(1);
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
    expect(results[1]?.title).toBe('topic1');
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
    expect(results[1]?.url).toBe('https://e.com/2');
  });
});

describe('fallback search provider', () => {
  it('主 provider 失败回退', async () => {
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

  it('主 provider 空结果回退', async () => {
    const primary: SearchProvider = {
      name: 'primary',
      async search() {
        return [];
      },
    };
    const fallback: SearchProvider = {
      name: 'fallback',
      async search() {
        return [{ title: 'fb', url: 'https://e.com/fb', snippet: 's' }];
      },
    };
    const provider = createFallbackSearchProvider([primary, fallback]);
    const results = await provider.search('q');
    expect(results).toHaveLength(1);
  });

  it('全部失败抛最后一个错误', async () => {
    const primary: SearchProvider = {
      name: 'primary',
      async search() {
        throw new Error('boom');
      },
    };
    const provider = createFallbackSearchProvider([primary]);
    await expect(provider.search('q')).rejects.toThrow(/boom/);
  });
});

describe('registerBuiltinTools 搜索回退', () => {
  it('searxng 缺 endpoint 回退 duckduckgo（不抛错）', async () => {
    const registry = new ToolRegistry();
    const fakeFetch: FetchLike = async () =>
      fakeResponse({
        contentType: 'application/json',
        json: async () => ({
          AbstractText: 'ddg answer',
          Heading: 'H',
          AbstractURL: 'https://e.com/a',
        }),
      });
    const names = registerBuiltinTools(registry, makeSecurity(false), { fetchImpl: fakeFetch });
    expect(names).toContain('builtin.web_search');
    const tool = registry.get('builtin.web_search');
    const res = (await tool!.execute({ query: 'x' })) as { results: { title: string }[] };
    expect(res.results).toHaveLength(1);
    expect(res.results[0]?.title).toBe('H');
  });

  it('tavily 无 apiKey 且无可用回退时报错', () => {
    const registry = new ToolRegistry();
    const security: SecurityConfig = {
      ...makeSecurity(false),
      webSearch: {
        provider: 'tavily',
        fallback: 'tavily',
        maxResults: 8,
        timeoutMs: 1000,
      },
    };
    expect(() => registerBuiltinTools(registry, security)).toThrow(/No search provider available/);
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
      title: string;
      content: string;
    };
    expect(res.content).toContain('Hello world content here');
  });

  it('非 2xx 抛错', async () => {
    const fakeFetch: FetchLike = async () => fakeResponse({ ok: false, status: 404 });
    const policy: WebPolicy = {
      allowDomains: [],
      denyDomains: [],
      timeoutMs: 1000,
      maxOutputBytes: 100,
    };
    const tool = createWebFetchTool(policy, fakeFetch);
    await expect(tool.execute({ url: 'https://example.com/x' })).rejects.toThrow(/404/);
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

  it('text/plain 直接返回正文（不报 unsupported）', async () => {
    const fakeFetch: FetchLike = async () =>
      fakeResponse({
        contentType: 'text/plain; charset=utf-8',
        text: async () => '  raw text body  ',
      });
    const policy: WebPolicy = {
      allowDomains: [],
      denyDomains: [],
      timeoutMs: 1000,
      maxOutputBytes: 10_000,
    };
    const tool = createWebFetchTool(policy, fakeFetch);
    const res = (await tool.execute({ url: 'https://raw.githubusercontent.com/x/y' })) as {
      content: string;
      title: string;
    };
    expect(res.content).toBe('raw text body');
    expect(res.title).toBe('https://raw.githubusercontent.com/x/y');
  });

  it('content-length 超限预检拒绝且不读正文', async () => {
    let read = false;
    const fakeFetch: FetchLike = async () => {
      return fakeResponse({
        contentType: 'text/html',
        headers: { 'content-length': '9999999' },
        text: async () => {
          read = true;
          return 'x';
        },
      });
    };
    const policy: WebPolicy = {
      allowDomains: [],
      denyDomains: [],
      timeoutMs: 1000,
      maxOutputBytes: 100,
    };
    const tool = createWebFetchTool(policy, fakeFetch);
    await expect(tool.execute({ url: 'https://example.com/big' })).rejects.toThrow(
      /content too large/,
    );
    expect(read).toBe(false);
  });
});

describe('datetime', () => {
  it('datetime now', async () => {
    const tool = createDatetimeTool();
    const res = (await tool.execute({ action: 'now' })) as { iso: string; epochMs: number };
    expect(typeof res.epochMs).toBe('number');
    expect(res.iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('datetime parse', async () => {
    const tool = createDatetimeTool();
    const res = (await tool.execute({ action: 'parse', value: '2024-01-01T00:00:00Z' })) as {
      epochMs: number;
    };
    expect(res.epochMs).toBe(new Date('2024-01-01T00:00:00Z').getTime());
  });

  it('datetime format 含星期与时分（完整输出）', async () => {
    const tool = createDatetimeTool();
    const res = (await tool.execute({
      action: 'format',
      value: '2024-01-01T00:00:00Z',
      timeZone: 'Asia/Shanghai',
      locale: 'zh-CN',
    })) as { formatted: string };
    // 2024-01-01 00:00 UTC = 北京时间周一 08:00
    expect(res.formatted).toContain('星期一');
    expect(res.formatted).toContain('08');
  });
});

describe('registerBuiltinTools', () => {
  it('默认只注册通用原语（todo/datetime/web_search/web_fetch）', () => {
    const registry = new ToolRegistry();
    const names = registerBuiltinTools(registry, makeSecurity(false));

    expect(registry.has('builtin.todo')).toBe(true);
    expect(registry.has('builtin.datetime')).toBe(true);
    expect(registry.has('builtin.web_search')).toBe(true);
    expect(registry.has('builtin.web_fetch')).toBe(true);

    // 垂直 / 鸡肋工具不再内置
    expect(registry.has('builtin.read_file')).toBe(false);
    expect(registry.has('builtin.write_file')).toBe(false);
    expect(registry.has('builtin.bash')).toBe(false);
    expect(registry.has('builtin.sitesearch')).toBe(false);
    expect(registry.has('builtin.calculator')).toBe(false);
    expect(registry.has('builtin.json')).toBe(false);
    expect(registry.has('builtin.base64')).toBe(false);

    expect(names).toEqual([
      'builtin.todo',
      'builtin.datetime',
      'builtin.web_search',
      'builtin.web_fetch',
    ]);
  });
});
