import type { NextRequest } from 'next/server';
import { installItem } from '@/lib/agents-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST /api/marketplace/items/:id/install —— 安装商品，生成 agent 实例。 */
export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    configOverrides?: Record<string, unknown>;
  };

  try {
    const result = await installItem(id, body.configOverrides ?? {});
    return Response.json(result, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
