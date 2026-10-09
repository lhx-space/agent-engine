import type { NextRequest } from 'next/server';
import { resolveConversationStore } from '@/lib/conversation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ name: string; id: string }>;
}

/** GET /api/agent/:name/sessions/:id/messages —— 读取指定会话的历史消息（按 seq 升序）。 */
export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const { name, id } = await context.params;
  const rawLimit = request.nextUrl.searchParams.get('limit');
  const rawBefore = request.nextUrl.searchParams.get('beforeSeq');
  const handle = await resolveConversationStore(name);
  try {
    const messages = await handle.store.listMessages(id, {
      ...(rawLimit !== null && Number.isFinite(Number(rawLimit))
        ? { limit: Number(rawLimit) }
        : {}),
      ...(rawBefore !== null && Number.isFinite(Number(rawBefore))
        ? { beforeSeq: Number(rawBefore) }
        : {}),
    });
    return Response.json({ sessionId: id, messages });
  } finally {
    await handle.dispose();
  }
}
