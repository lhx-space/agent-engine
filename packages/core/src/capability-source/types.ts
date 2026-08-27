/** 归一化后的 MCP server（command 形态，registry 来源已转成 npx）。 */
export interface ResolvedMcpServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}
