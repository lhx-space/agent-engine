import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';
import type { McpServer as McpServerConfig } from '@lhx-agent-engine/config';
import type { ToolSource } from '@lhx-agent-engine/core';
import type { PluginContext } from '@lhx-agent-engine/core/plugins';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createMcpPlugin,
  normalizeCallToolResult,
  resolveMcpServer,
  resolveMcpServers,
  toTool,
} from '../src/index';

function makeCtx(): { ctx: PluginContext; sources: ToolSource[] } {
  const sources: ToolSource[] = [];
  const ctx = {
    registerToolSource: (source: ToolSource) => sources.push(source),
  } as PluginContext;
  return { ctx, sources };
}

describe('mcp 工具归一化', () => {
  it('toTool 透传原生 JSON Schema 并支持 callTool 往返', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const server = new McpServer({ name: 'test-server', version: '1.0.0' });
    server.registerTool(
      'get_weather',
      { description: '获取城市天气', inputSchema: { city: z.string() } },
      async (args) => {
        return { content: [{ type: 'text', text: `weather in ${args.city}: sunny` }] };
      },
    );
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);

    const { tools } = await client.listTools();
    expect(tools).toHaveLength(1);

    const tool = toTool(tools[0], client);
    expect(tool.name).toBe('get_weather');
    expect(tool.jsonSchema).toMatchObject({
      type: 'object',
      properties: { city: { type: 'string' } },
    });

    const result = await tool.execute({ city: 'beijing' });
    expect(result).toBe('weather in beijing: sunny');

    await client.close();
    await server.close();
  });

  it('normalizeCallToolResult 拼接 text 块 + isError 抛错', () => {
    expect(
      normalizeCallToolResult('t', {
        content: [
          { type: 'text', text: 'a' },
          { type: 'text', text: 'b' },
        ],
      }),
    ).toBe('ab');

    expect(() =>
      normalizeCallToolResult('t', { content: [{ type: 'text', text: 'boom' }], isError: true }),
    ).toThrow(/boom/);
  });
});

describe('resolveMcpServer（来源归一化）', () => {
  it('command 原样透传 / registry 归一化为 npx', () => {
    expect(
      resolveMcpServer({ source: 'command', name: 'a', command: 'node', args: ['s'] }),
    ).toEqual({ name: 'a', command: 'node', args: ['s'] });
    expect(resolveMcpServer({ source: 'registry', name: 'b', package: 'pkg', args: [] })).toEqual({
      name: 'b',
      command: 'npx',
      args: ['-y', 'pkg'],
    });
  });

  it('批量归一化', () => {
    const resolved = resolveMcpServers([
      { source: 'command', name: 'a', command: 'node', args: ['s'] },
      { source: 'registry', name: 'b', package: 'pkg', args: [] },
    ]);
    expect(resolved.map((r) => r.command)).toEqual(['node', 'npx']);
  });
});

describe('createMcpPlugin', () => {
  it('安装后注册 ToolSource', async () => {
    const servers: McpServerConfig[] = [
      { source: 'command', name: 'a', command: 'node', args: ['s'] },
    ];
    const { ctx, sources } = makeCtx();
    await createMcpPlugin(servers).install(ctx);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.name).toBe('@lhx-agent-engine/plugin-mcp');
  });

  it('空 servers 不注册 ToolSource', async () => {
    const { ctx, sources } = makeCtx();
    await createMcpPlugin([]).install(ctx);
    expect(sources).toHaveLength(0);
  });
});
