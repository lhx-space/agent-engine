import { describe, expect, it } from '@rstest/core';
import { resolveMcpServer, resolveMcpServers } from '../src/capability-source/mcp';

describe('resolveMcpServer（来源归一化）', () => {
  it('command 来源原样透传', () => {
    const resolved = resolveMcpServer({
      source: 'command',
      name: 'github',
      command: 'npx',
      args: ['-y', 'server'],
      env: { TOKEN: 'x' },
    });
    expect(resolved).toEqual({
      name: 'github',
      command: 'npx',
      args: ['-y', 'server'],
      env: { TOKEN: 'x' },
    });
  });

  it('registry 来源归一化为 npx -y <package>', () => {
    const resolved = resolveMcpServer({
      source: 'registry',
      name: 'github',
      package: '@modelcontextprotocol/server-github',
      args: [],
    });
    expect(resolved.command).toBe('npx');
    expect(resolved.args).toEqual(['-y', '@modelcontextprotocol/server-github']);
  });

  it('registry 来源保留额外 args', () => {
    const resolved = resolveMcpServer({
      source: 'registry',
      name: 'github',
      package: '@modelcontextprotocol/server-github',
      args: ['--flag'],
    });
    expect(resolved.args).toEqual(['-y', '@modelcontextprotocol/server-github', '--flag']);
  });

  it('批量归一化', () => {
    const resolved = resolveMcpServers([
      { source: 'command', name: 'a', command: 'node', args: ['s'] },
      { source: 'registry', name: 'b', package: 'pkg', args: [] },
    ]);
    expect(resolved.map((r) => r.command)).toEqual(['node', 'npx']);
  });
});
