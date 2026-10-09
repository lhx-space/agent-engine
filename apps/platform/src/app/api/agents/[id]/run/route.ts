import type { NextRequest } from 'next/server';
import { getAgentBundle } from '@/lib/agents-repo';
import { runBundle } from '@/lib/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/agents/:id/run —— 运行实例。
 * 会话 id 经 `x-session-id` 头或 body 传入，缺失时内核生成并在响应头回传。
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    input?: unknown;
    sessionId?: unknown;
  };
  const input = typeof body.input === 'string' ? body.input : '';
  if (!input) return Response.json({ error: 'input is required' }, { status: 400 });

  const bundle = await getAgentBundle(id);
  if (!bundle) return Response.json({ error: 'agent not found' }, { status: 404 });

  const sessionId =
    request.headers.get('x-session-id') ??
    (typeof body.sessionId === 'string' && body.sessionId ? body.sessionId : undefined);

  try {
    const result = await runBundle(bundle, input, sessionId);
    return Response.json(result, { headers: { 'x-session-id': result.sessionId } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
