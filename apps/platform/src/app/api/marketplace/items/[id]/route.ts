import type { NextRequest } from 'next/server';
import { getItem, deleteItem, listVersions, updateItem } from '@/lib/marketplace-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/marketplace/items/:id —— 商品详情 + 版本列表。 */
export async function GET(_request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const item = await getItem(id);
  if (!item) return Response.json({ error: 'item not found' }, { status: 404 });
  const versions = await listVersions(id);
  return Response.json({ item, versions });
}

/** PATCH /api/marketplace/items/:id —— 改元信息（status 支持 deprecated 下架标记）。 */
export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const allowed = ['name', 'summary', 'descriptionMd', 'status', 'visibility', 'tags', 'iconUrl'];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  const row = await updateItem(id, patch as Parameters<typeof updateItem>[1]);
  if (!row) return Response.json({ error: 'item not found' }, { status: 404 });
  return Response.json(row);
}

/** DELETE /api/marketplace/items/:id —— 删商品（级联删版本/安装；已生成实例保留但解绑）。 */
export async function DELETE(_request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const ok = await deleteItem(id);
  if (!ok) return Response.json({ error: 'item not found' }, { status: 404 });
  return Response.json({ ok: true });
}
