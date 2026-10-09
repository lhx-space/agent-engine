import type { NextRequest } from 'next/server';
import {
  deleteAgentDocument,
  listAgentDocuments,
  upsertAgentDocument,
} from '@/lib/marketplace-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/agents/:id/documents —— 知识库文档清单（不含正文，正文按需单独取）。 */
export async function GET(_request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const docs = await listAgentDocuments(id);
  return Response.json({
    documents: docs.map((doc) => ({ name: doc.name, size: doc.size, createdAt: doc.createdAt })),
  });
}

/** POST /api/agents/:id/documents —— 新增或覆盖文档（body: name / content）。 */
export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { name?: string; content?: string };
  if (!body.name || !body.content) {
    return Response.json({ error: 'name 与 content 必填' }, { status: 400 });
  }
  const row = await upsertAgentDocument({ agentId: id, name: body.name, content: body.content });
  return Response.json({ name: row.name, size: row.size }, { status: 201 });
}

/** DELETE /api/agents/:id/documents?name=xxx —— 删除文档。 */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const name = request.nextUrl.searchParams.get('name');
  if (!name) return Response.json({ error: 'name 必填' }, { status: 400 });
  const ok = await deleteAgentDocument(id, name);
  if (!ok) return Response.json({ error: 'document not found' }, { status: 404 });
  return Response.json({ ok: true });
}
