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
import { createBase64Tool } from '../src/tools/builtin/base64';
import { createBashTool } from '../src/tools/builtin/bash';
import { createCalculatorTool } from '../src/tools/builtin/calculator';
import { createDatetimeTool } from '../src/tools/builtin/datetime';
import { createReadFileTool, createWriteFileTool } from '../src/tools/builtin/file';
import { createJsonTool } from '../src/tools/builtin/json';
import { createSiteSearchTool } from '../src/tools/builtin/sitesearch';
import { createTodoTool, TodoStore } from '../src/tools/builtin/todo';
import type { TodoItem } from '../src/tools/builtin/todo';
import { createWebFetchTool } from '../src/tools/builtin/web-fetch';
import { createWebSearchTool } from '../src/tools/builtin/web-search';
import { createDuckDuckGoSearchProvider } from '../src/tools/utils/duckduckgo';
import type { FetchLike, HttpResponse } from '../src/tools/utils/http';
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
    webSearch: { provider: 'duckduckgo', maxResults: 8, timeoutMs: 1000 },
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
    const policy: WebSearchPolicy = { provider: 'fake', maxResults: 8, timeoutMs: 1000 };
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
    const policy: WebSearchPolicy = { provider: 'many', maxResults: 3, timeoutMs: 1000 };
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
});

describe('calculator / datetime / json / base64', () => {
  it('calculator 求值', async () => {
    const tool = createCalculatorTool();
    const res = (await tool.execute({ expression: '2 + 3 * 4' })) as { result: number };
    expect(res.result).toBe(14);
  });

  it('calculator 非法表达式报错', async () => {
    const tool = createCalculatorTool();
    await expect(tool.execute({ expression: '2 +' })).rejects.toThrow(/Invalid expression/);
  });

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

  it('json parse', async () => {
    const tool = createJsonTool();
    const res = (await tool.execute({ action: 'parse', input: '{"a":1}' })) as {
      value: { a: number };
    };
    expect(res.value).toEqual({ a: 1 });
  });

  it('json parse 非法报错', async () => {
    const tool = createJsonTool();
    await expect(tool.execute({ action: 'parse', input: '{bad' })).rejects.toThrow(/Invalid JSON/);
  });

  it('json stringify', async () => {
    const tool = createJsonTool();
    const res = (await tool.execute({ action: 'stringify', value: { a: 1 } })) as {
      json: string;
    };
    expect(JSON.parse(res.json)).toEqual({ a: 1 });
  });

  it('base64 encode/decode 往返', async () => {
    const tool = createBase64Tool();
    const encoded = (await tool.execute({ action: 'encode', input: '你好' })) as {
      encoded: string;
    };
    const decoded = (await tool.execute({ action: 'decode', input: encoded.encoded })) as {
      decoded: string;
    };
    expect(decoded.decoded).toBe('你好');
  });
});

describe('sitesearch', () => {
  it('携带 site 过滤调用 provider', async () => {
    let lastSite: string | undefined;
    const provider: SearchProvider = {
      name: 'fake',
      async search(query, opts) {
        lastSite = opts?.site;
        return [{ title: `t-${query}`, url: 'https://e.com/x', snippet: 's' }];
      },
    };
    const policy = { provider: 'fake', maxResults: 8, timeoutMs: 1000 };
    const tool = createSiteSearchTool(provider, policy);
    const res = (await tool.execute({ query: 'hello', site: 'example.com' })) as {
      site: string;
      results: unknown[];
    };
    expect(lastSite).toBe('example.com');
    expect(res.site).toBe('example.com');
    expect(res.results).toHaveLength(1);
  });
});

describe('registerBuiltinTools', () => {
  it('默认注册全部非 bash 内置工具', () => {
    const registry = new ToolRegistry();
    const names = registerBuiltinTools(registry, makeSecurity(false));

    expect(registry.has('builtin.todo')).toBe(true);
    expect(registry.has('builtin.read_file')).toBe(true);
    expect(registry.has('builtin.write_file')).toBe(true);
    expect(registry.has('builtin.web_search')).toBe(true);
    expect(registry.has('builtin.web_fetch')).toBe(true);
    expect(registry.has('builtin.sitesearch')).toBe(true);
    expect(registry.has('builtin.calculator')).toBe(true);
    expect(registry.has('builtin.datetime')).toBe(true);
    expect(registry.has('builtin.json')).toBe(true);
    expect(registry.has('builtin.base64')).toBe(true);
    expect(registry.has('builtin.bash')).toBe(false);
    expect(names).not.toContain('builtin.bash');
  });

  it('tools 配置不收窄内置工具（恒全注册）', () => {
    const registry = new ToolRegistry();
    registerBuiltinTools(registry, makeSecurity(false));

    // 即使语义上有额外工具引用，内置工具仍全部注册。
    expect(registry.has('builtin.todo')).toBe(true);
    expect(registry.has('builtin.read_file')).toBe(true);
    expect(registry.has('builtin.write_file')).toBe(true);
    expect(registry.has('builtin.web_search')).toBe(true);
    expect(registry.has('builtin.web_fetch')).toBe(true);
    expect(registry.has('builtin.sitesearch')).toBe(true);
    expect(registry.has('builtin.calculator')).toBe(true);
    expect(registry.has('builtin.datetime')).toBe(true);
    expect(registry.has('builtin.json')).toBe(true);
    expect(registry.has('builtin.base64')).toBe(true);
  });

  it('enabled + 注入沙箱注册 bash', () => {
    const registry = new ToolRegistry();
    const names = registerBuiltinTools(registry, makeSecurity(true), { sandbox: fakeSandbox });

    expect(registry.has('builtin.bash')).toBe(true);
    expect(names).toContain('builtin.bash');
  });

  it('enabled 但无沙箱抛错', () => {
    const registry = new ToolRegistry();
    expect(() =>
      registerBuiltinTools(registry, makeSecurity(true), {
        resolveSandbox: () => ({
          available: false,
          reason: 'no sandbox backend available (docker / nsjail)',
        }),
      }),
    ).toThrow(/no sandbox/);
  });
});
