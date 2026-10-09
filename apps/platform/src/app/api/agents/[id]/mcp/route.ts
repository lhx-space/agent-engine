import type { NextRequest } from 'next/server';
import {
  addAgentMcpServer,
  deleteAgentMcpServer,
  listAgentMcpServers,
} from '@/lib/marketplace-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/agents/:id/mcp —— MCP server 列表。 */
export async function GET(_request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return Response.json({ servers: await listAgentMcpServers(id) });
}

/** POST /api/agents/:id/mcp —— 新增 MCP server（body: name / spec）。 */
export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    spec?: Record<string, unknown>;
  };
  if (!body.name || !body.spec) {
    return Response.json({ error: 'name 与 spec 必填' }, { status: 400 });
  }
  const row = await addAgentMcpServer({ agentId: id, name: body.name, spec: body.spec });
  return Response.json(row, { status: 201 });
}

/** DELETE /api/agents/:id/mcp?name=xxx —— 删除 MCP server。 */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const name = request.nextUrl.searchParams.get('name');
  if (!name) return Response.json({ error: 'name 必填' }, { status: 400 });
  const ok = await deleteAgentMcpServer(id, name);
  if (!ok) return Response.json({ error: 'server not found' }, { status: 404 });
  return Response.json({ ok: true });
}
