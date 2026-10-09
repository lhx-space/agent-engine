import type { NextRequest } from 'next/server';
import { resolveConversationStore } from '@/lib/conversation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ name: string }>;
}

/** GET /api/agent/:name/sessions —— 列举该 agent 的历史会话（按最近更新降序）。 */
export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const { name } = await context.params;
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? 20);
  const handle = await resolveConversationStore(name);
  try {
    const sessions = await handle.store.listSessions({
      agentName: name,
      limit: Number.isFinite(limit) ? limit : 20,
    });
    return Response.json({ persistent: handle.persistent, sessions });
  } finally {
    await handle.dispose();
  }
}
