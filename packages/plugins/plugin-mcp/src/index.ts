import type { McpServer } from '@agent-engine/config';
import type { ToolSource } from '@agent-engine/core';
import type { Plugin } from '@agent-engine/core/plugins';
import { connectMcpServers } from './client';
import { resolveMcpServers } from './mcp';

// ============ re-export ============

export { connectMcpServer, connectMcpServers } from './client';
export type { ConnectMcpServersResult } from './client';
export { toTool, normalizeCallToolResult } from './normalize';
export type { McpToolMeta } from './normalize';
export { resolveMcpServer, resolveMcpServers } from './mcp';
export type { McpConnection, ResolvedMcpServer } from './types';

/**
 * 创建 MCP 工具来源插件：注册一个 `ToolSource`，装配时连接全部 `mcp.servers`
 * （stdio transport）并把归一化工具注入内核；单个 server 连接失败隔离（不阻断整体）。
 * `config.mcp.servers` 字段的解释权移交本插件（D1-A：字段不变、零迁移）。
 */
export function createMcpPlugin(servers: McpServer[]): Plugin {
  return {
    name: '@agent-engine/plugin-mcp',
    description: 'MCP 工具来源（stdio transport，经 ToolSource 注入）',
    version: '0.1.0',
    tags: ['mcp', '工具来源'],
    install(ctx) {
      if (servers.length === 0) return;
      const source: ToolSource = {
        name: '@agent-engine/plugin-mcp',
        async resolve() {
          const { tools, errors, dispose } = await connectMcpServers(resolveMcpServers(servers));
          for (const { name, error } of errors) {
            console.warn(`[plugin-mcp] MCP server "${name}" 连接失败，已跳过：${error.message}`);
          }
          return { tools, dispose };
        },
      };
      ctx.registerToolSource(source);
    },
  };
}
