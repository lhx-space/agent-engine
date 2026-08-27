import type { McpServer } from '@agent-engine/config';
import type { ResolvedMcpServer } from './types';

/**
 * 把配置里的 MCP server 归一化为 command 形态：
 * - `command` 来源：原样透传；
 * - `registry` 来源：归一化为 `npx -y <package> [args...]`（复用官方 MCP registry / npm 生态）。
 */
export function resolveMcpServer(server: McpServer): ResolvedMcpServer {
  if (server.source === 'registry') {
    return {
      name: server.name,
      command: 'npx',
      args: ['-y', server.package, ...server.args],
      env: server.env,
    };
  }
  return {
    name: server.name,
    command: server.command,
    args: server.args,
    env: server.env,
  };
}

/** 批量归一化。 */
export function resolveMcpServers(servers: McpServer[]): ResolvedMcpServer[] {
  return servers.map(resolveMcpServer);
}
