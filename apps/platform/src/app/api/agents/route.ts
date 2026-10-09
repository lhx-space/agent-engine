import type { NextRequest } from 'next/server';
import { desc } from 'drizzle-orm';
import { getPlatformDb } from '@/db/client';
import { agents } from '@/db/schema';
import { createAgent } from '@/lib/agents-repo';
import { parseManifest } from '@/lib/manifest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/agents —— 已安装的 agent 实例。 */
export async function GET(): Promise<Response> {
  const db = getPlatformDb();
  const rows = await db.select().from(agents).orderBy(desc(agents.updatedAt));
  return Response.json({ agents: rows });
}

/** POST /api/agents —— 直接创建实例（不经市场）。body: { name, config } */
export async function POST(request: NextRequest): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { name?: string; config?: unknown };
  const parsed = parseManifest(body.config);
  if (!parsed.ok) {
    return Response.json({ error: 'config 校验失败', issues: parsed.issues }, { status: 400 });
  }
  const row = await createAgent({ name: body.name ?? parsed.config.name, config: parsed.config });
  return Response.json(row, { status: 201 });
}
