import { z } from 'zod';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Tool } from '../tools/types';

/** MCP 工具 meta（`listTools()` 返回的单条）。 */
export interface McpToolMeta {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/**
 * pass-through 入参 schema：运行时不做强校验（真正的入参校验由 MCP server 完成），
 * 对外 tool definition 的 `parameters` 改用 `jsonSchema` 透传原生 JSON Schema。
 */
const PASSTHROUGH_SCHEMA = z.unknown();

/** 把 MCP 工具归一化为标准 `Tool`。 */
export function toTool(tool: McpToolMeta, client: Client): Tool {
  return {
    name: tool.name,
    description: tool.description ?? '',
    inputSchema: PASSTHROUGH_SCHEMA,
    jsonSchema: tool.inputSchema ?? { type: 'object' },
    execute: async (input) => {
      const args = (input ?? {}) as Record<string, unknown>;
      const result = await client.callTool({ name: tool.name, arguments: args });
      return normalizeCallToolResult(tool.name, result);
    },
  };
}

/** 把 `callTool` 结果归一化为字符串（拼接 text 块）；`isError` 时抛错。 */
export function normalizeCallToolResult(name: string, result: unknown): string {
  const { content, isError } = result as { content?: unknown; isError?: boolean };
  const parts: string[] = [];
  if (Array.isArray(content)) {
    for (const block of content) {
      if (
        block !== null &&
        typeof block === 'object' &&
        (block as { type?: unknown }).type === 'text'
      ) {
        parts.push((block as { text: string }).text);
      }
    }
  }
  const text = parts.join('');
  if (isError) {
    throw new Error(`MCP tool "${name}" returned an error: ${text}`);
  }
  return text;
}
