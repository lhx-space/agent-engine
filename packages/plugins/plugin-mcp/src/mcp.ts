import type { McpServer } from '@agent-engine/config';
import type { ResolvedMcpServer } from './types';

/**
 * 把配置里的 MCP server 归一化为可连接形态：
 * - `command` 来源：原样透传（stdio）；
 * - `registry` 来源：归一化为 `npx -y <package> [args...]`（stdio）；
 * - `http` 来源：远程连接（streamable-http / sse）。
 */
export function resolveMcpServer(server: McpServer): ResolvedMcpServer {
  if (server.source === 'registry') {
    return {
      kind: 'stdio',
      name: server.name,
      command: 'npx',
      args: ['-y', server.package, ...server.args],
      env: server.env,
    };
  }
  if (server.source === 'http') {
    return {
      kind: 'http',
      name: server.name,
      url: server.url,
      transport: server.transport,
      headers: server.headers,
    };
  }
  return {
    kind: 'stdio',
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
