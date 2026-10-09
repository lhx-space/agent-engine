import type { NextRequest } from 'next/server';
import { getAgentBundle } from '@/lib/agents-repo';
import { toRunnableConfig } from '@/lib/agents-repo';
import { openConversationStore } from '@/lib/history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/agents/:id/sessions —— 列举该实例的会话历史。
 * 会话存在引擎库，这里按 agentName 字符串软关联（无跨库外键）。
 */
export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? 20);

  const bundle = await getAgentBundle(id);
  if (!bundle) return Response.json({ error: 'agent not found' }, { status: 404 });
  const config = toRunnableConfig(bundle);
  if (!config) return Response.json({ error: 'config 与当前 Schema 不兼容' }, { status: 409 });

  const handle = await openConversationStore(config);
  try {
    const sessions = await handle.store.listSessions({
      agentName: config.name,
      limit: Number.isFinite(limit) ? limit : 20,
    });
    return Response.json({ persistent: handle.persistent, sessions });
  } finally {
    await handle.dispose();
  }
}
