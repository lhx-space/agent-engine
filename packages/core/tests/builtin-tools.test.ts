import { describe, expect, it } from '@rstest/core';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { BashPolicy, FilePolicy, SecurityConfig } from '@lhx-agent-engine/config';
import type { SandboxBackend, SandboxExecResult } from '../src/sandbox/types';
import { ToolRegistry } from '../src/tools/registry';
import { createBashTool } from '../src/tools/bash';
import { createDatetimeTool } from '../src/tools/builtin/datetime';
import { createListFilesTool, createReadFileTool, createWriteFileTool } from '../src/tools/file';
import { createTodoTool, TodoStore } from '../src/tools/builtin/todo';
import type { TodoItem } from '../src/tools/builtin/todo';
import type { FetchLike, HttpResponse } from '../src/tools/utils/http';
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

describe('read_file UTF-8 截断', () => {
  it('截断不切断多字节字符', async () => {
    await withTempDir(async (dir) => {
      const content = 'ab中'; // '中' 为 3 字节
      await fs.writeFile(path.join(dir, 'a.txt'), content);
      // maxFileBytes=4 落在 '中' 的第 2 个连续字节，安全截断应回退到 '中' 之前。
      const tool = createReadFileTool({ roots: [dir], maxFileBytes: 4 });
      const res = (await tool.execute({ path: path.join(dir, 'a.txt') })) as {
        content: string;
        truncated: boolean;
      };
      expect(res.truncated).toBe(true);
      expect(res.content).toContain('ab');
      expect(res.content).not.toContain('\uFFFD');
    });
  });
});

describe('list_files', () => {
  it('列举根目录（目录优先 + 排序）', async () => {
    await withTempDir(async (dir) => {
      await fs.writeFile(path.join(dir, 'b.txt'), 'b');
      await fs.mkdir(path.join(dir, 'a-dir'));
      await fs.writeFile(path.join(dir, 'a-dir', 'x.txt'), 'x');
      const tool = createListFilesTool({ roots: [dir], maxFileBytes: 1024 });
      const res = (await tool.execute({ path: dir, maxDepth: 0 })) as {
        entries: { path: string; type: string }[];
      };
      expect(res.entries.map((e) => e.path)).toEqual(['a-dir', 'b.txt']);
      expect(res.entries[0]?.type).toBe('dir');
    });
  });

  it('glob 过滤', async () => {
    await withTempDir(async (dir) => {
      await fs.writeFile(path.join(dir, 'a.ts'), '');
      await fs.writeFile(path.join(dir, 'b.md'), '');
      const tool = createListFilesTool({ roots: [dir], maxFileBytes: 1024 });
      const res = (await tool.execute({ path: dir, glob: '*.ts' })) as {
        entries: { path: string }[];
      };
      expect(res.entries.map((e) => e.path)).toEqual(['a.ts']);
    });
  });

  it('maxEntries 截断置 truncated', async () => {
    await withTempDir(async (dir) => {
      await fs.writeFile(path.join(dir, 'a.txt'), '');
      await fs.writeFile(path.join(dir, 'b.txt'), '');
      await fs.writeFile(path.join(dir, 'c.txt'), '');
      const tool = createListFilesTool({ roots: [dir], maxFileBytes: 1024 });
      const res = (await tool.execute({ path: dir, maxEntries: 2 })) as {
        entries: unknown[];
        truncated: boolean;
      };
      expect(res.entries).toHaveLength(2);
      expect(res.truncated).toBe(true);
    });
  });

  it('越界路径拒绝', async () => {
    await withTempDir(async (dir) => {
      await withTempDir(async (outside) => {
        const tool = createListFilesTool({ roots: [dir], maxFileBytes: 1024 });
        await expect(tool.execute({ path: outside })).rejects.toThrow(/outside allowed roots/);
      });
    });
  });

  it('非目录报错', async () => {
    await withTempDir(async (dir) => {
      await fs.writeFile(path.join(dir, 'f.txt'), '');
      const tool = createListFilesTool({ roots: [dir], maxFileBytes: 1024 });
      await expect(tool.execute({ path: path.join(dir, 'f.txt') })).rejects.toThrow(
        /Not a directory/,
      );
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

  it('datetime now 带 timeZone 返回本地化 formatted', async () => {
    const tool = createDatetimeTool();
    const res = (await tool.execute({
      action: 'now',
      timeZone: 'Asia/Shanghai',
      locale: 'zh-CN',
    })) as { formatted?: string };
    expect(res.formatted).toBeDefined();
    expect(res.formatted).toContain('星期');
  });
});

describe('registerBuiltinTools', () => {
  it('默认只注册通用原语（todo/datetime）', () => {
    const registry = new ToolRegistry();
    const names = registerBuiltinTools(registry);

    expect(registry.has('builtin.todo')).toBe(true);
    expect(registry.has('builtin.datetime')).toBe(true);

    // 垂直 / web 工具不再内置（web_search/web_fetch 已外放 plugin-web）
    expect(registry.has('builtin.read_file')).toBe(false);
    expect(registry.has('builtin.write_file')).toBe(false);
    expect(registry.has('builtin.bash')).toBe(false);
    expect(registry.has('builtin.web_search')).toBe(false);
    expect(registry.has('builtin.web_fetch')).toBe(false);

    expect(names).toEqual(['builtin.todo', 'builtin.datetime']);
  });
});
