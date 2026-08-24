import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { normalizeCallToolResult, toTool } from '../src/mcp/normalize';

describe('mcp 工具归一化', () => {
  it('toTool 透传原生 JSON Schema 并支持 callTool 往返', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const server = new McpServer({ name: 'test-server', version: '1.0.0' });
    server.registerTool(
      'get_weather',
      {
        description: '获取城市天气',
        inputSchema: { city: z.string() },
      },
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
    expect(tool.description).toBe('获取城市天气');
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
