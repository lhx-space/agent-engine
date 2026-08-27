import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ResolvedMcpServer } from '../capability-source/types';
import type { CapabilityBundle } from '../capability/types';
import { toTool } from './normalize';
import type { McpConnection } from './types';

const CLIENT_INFO = { name: 'agent-engine', version: '0.1.0' };

/**
 * 解析 MCP server 的进程环境：用户声明的 `env` 需要合并到宿主 `process.env` 之上，
 * 否则（如仅传 `GITHUB_TOKEN`）会丢失 `PATH` 等，导致 `npx` 等命令无法启动。
 */
function resolveEnv(env: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!env) return undefined;
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) merged[key] = value;
  }
  return { ...merged, ...env };
}

/** 连接一个 MCP server（stdio transport），并把其工具归一化为标准 Tool。 */
export async function connectMcpServer(server: ResolvedMcpServer): Promise<McpConnection> {
  const client = new Client(CLIENT_INFO);
  const transport = new StdioClientTransport({
    command: server.command,
    args: server.args,
    env: resolveEnv(server.env),
  });

  try {
    await client.connect(transport);
  } catch (error) {
    throw new Error(
      `Failed to connect MCP server "${server.name}": ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }

  const { tools } = await client.listTools();
  const normalized = tools.map((tool) => toTool(tool, client));

  let closed = false;
  return {
    name: server.name,
    tools: normalized,
    close: async () => {
      if (closed) return;
      closed = true;
      await client.close();
    },
  };
}

/** `connectMcpServers` 的返回：统一能力束 + 失败项（错误隔离，单个失败不阻断整体）。 */
export interface ConnectMcpServersResult {
  /** 归一化工具 + `dispose` 关闭所有已连接 server。 */
  bundle: CapabilityBundle;
  errors: { name: string; error: Error }[];
}

/** 并发连接多个 MCP server；单个失败不阻断其他，失败项以错误报告返回。 */
export async function connectMcpServers(
  servers: ResolvedMcpServer[],
): Promise<ConnectMcpServersResult> {
  const settled = await Promise.allSettled(servers.map((server) => connectMcpServer(server)));

  const connections: McpConnection[] = [];
  const errors: { name: string; error: Error }[] = [];

  settled.forEach((result, index) => {
    const server = servers[index];
    if (result.status === 'fulfilled') {
      connections.push(result.value);
    } else {
      const reason = result.reason;
      errors.push({
        name: server?.name ?? `#${index}`,
        error: reason instanceof Error ? reason : new Error(String(reason)),
      });
    }
  });

  const bundle: CapabilityBundle = {
    tools: connections.flatMap((connection) => connection.tools),
    hooks: [],
    guardrails: [],
    promptFragments: [],
    memoryBackends: [],
    cacheBackends: [],
    vectorStores: [],
    embeddingProviders: [],
    tokenCounters: [],
    contextCompactors: [],
    retrievers: [],
    rerankers: [],
    summarizers: [],
    contextContributors: [],
    dispose: async () => {
      await Promise.all(connections.map((connection) => connection.close()));
    },
  };

  return { bundle, errors };
}
