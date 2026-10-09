import type { NextRequest } from 'next/server';
import { createSessionId } from '@lhx-agent-engine/core';
import { getAgentBundle } from '@/lib/agents-repo';
import { runBundleStream } from '@/lib/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/agents/:id/run/stream —— 流式运行（NDJSON，每行一个事件）。
 * 会话 id 经 `x-session-id` 传入；缺失时**在响应头里提前生成并回传**
 * （流式响应头必须在 body 写出前确定，故不能等 run 返回）。
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
    (typeof body.sessionId === 'string' && body.sessionId ? body.sessionId : createSessionId());

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        const result = await runBundleStream(bundle, input, sessionId, write);
        write({ type: 'session', sessionId: result.sessionId, persisted: result.persisted });
      } catch (error) {
        write({ type: 'error', error: error instanceof Error ? error.message : String(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson',
      'cache-control': 'no-cache',
      'x-session-id': sessionId,
    },
  });
}
