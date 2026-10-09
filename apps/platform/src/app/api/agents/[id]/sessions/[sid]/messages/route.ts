import type { NextRequest } from 'next/server';
import { getAgentBundle, toRunnableConfig } from '@/lib/agents-repo';
import { openConversationStore } from '@/lib/history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string; sid: string }>;
}

/** GET /api/agents/:id/sessions/:sid/messages —— 读取会话消息（按 seq 升序）。 */
export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id, sid } = await context.params;
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? 50);

  const bundle = await getAgentBundle(id);
  if (!bundle) return Response.json({ error: 'agent not found' }, { status: 404 });
  const config = toRunnableConfig(bundle);
  if (!config) return Response.json({ error: 'config 与当前 Schema 不兼容' }, { status: 409 });

  const handle = await openConversationStore(config);
  try {
    const messages = await handle.store.listMessages(sid, {
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return Response.json({ sessionId: sid, messages });
  } finally {
    await handle.dispose();
  }
}

/** DELETE /api/agents/:id/sessions/:sid/messages —— 删除会话（级联删消息，引擎侧）。 */
export async function DELETE(_request: NextRequest, context: RouteContext): Promise<Response> {
  const { id, sid } = await context.params;
  const bundle = await getAgentBundle(id);
  if (!bundle) return Response.json({ error: 'agent not found' }, { status: 404 });
  const config = toRunnableConfig(bundle);
  if (!config) return Response.json({ error: 'config 与当前 Schema 不兼容' }, { status: 409 });

  const handle = await openConversationStore(config);
  try {
    const ok = await handle.store.deleteSession(sid);
    if (!ok) return Response.json({ error: 'session not found' }, { status: 404 });
    return Response.json({ ok: true });
  } finally {
    await handle.dispose();
  }
}
