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

/** 归一化后的 MCP server（command 形态，registry 来源已转成 npx）。 */
export interface ResolvedMcpServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}
