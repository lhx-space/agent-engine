import type { Tool } from '@agent-engine/core/tools';

/** 已连接的 MCP server：暴露归一化工具与关闭句柄。 */
export interface McpConnection {
  /** server 名（对应配置 `mcp.servers[].name`）。 */
  name: string;
  /** 归一化后的标准 Tool 列表（`jsonSchema` 透传原生 schema）。 */
  tools: Tool[];
  /** 关闭连接（幂等）。 */
  close(): Promise<void>;
}

/** 归一化后的 MCP server：stdio（本地命令）/ http（远程，streamable-http / sse）。 */
export type ResolvedMcpServer =
  | {
      kind: 'stdio';
      name: string;
      command: string;
      args: string[];
      env?: Record<string, string>;
    }
  | {
      kind: 'http';
      name: string;
      url: string;
      transport: 'streamable-http' | 'sse';
      headers?: Record<string, string>;
    };
