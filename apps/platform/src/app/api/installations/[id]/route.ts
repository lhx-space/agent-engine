import type { NextRequest } from 'next/server';
import { deleteInstallation, setInstallationEnabled } from '@/lib/marketplace-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** PATCH /api/installations/:id —— 启停（body: { enabled }）。 */
export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
  if (typeof body.enabled !== 'boolean') {
    return Response.json({ error: 'enabled is required' }, { status: 400 });
  }
  const row = await setInstallationEnabled(id, body.enabled);
  if (!row) return Response.json({ error: 'installation not found' }, { status: 404 });
  return Response.json(row);
}

/** DELETE /api/installations/:id —— 卸载（删安装记录 + 关联实例与子表）。 */
export async function DELETE(_request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const ok = await deleteInstallation(id);
  if (!ok) return Response.json({ error: 'installation not found' }, { status: 404 });
  return Response.json({ ok: true });
}
