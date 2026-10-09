import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getPlatformDb } from '@/db/client';
import { marketplaceItems, marketplaceVersions } from '@/db/schema';
import { listVersions } from '@/lib/marketplace-repo';
import { parseManifest, serializeManifest } from '@/lib/manifest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/marketplace/items/:id/versions —— 版本列表（按发布时间倒序）。 */
export async function GET(_request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return Response.json({ versions: await listVersions(id) });
}

/**
 * POST /api/marketplace/items/:id/versions —— 发布新版本。
 * 旧版本 manifest 不可变，更新内容必须发新版本并推进 `latestVersionId`。
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    version?: string;
    config?: unknown;
    changelog?: string;
  };
  const parsed = parseManifest(body.config);
  if (!parsed.ok) {
    return Response.json({ error: 'manifest 校验失败', issues: parsed.issues }, { status: 400 });
  }

  const db = getPlatformDb();
  const [item] = await db
    .select()
    .from(marketplaceItems)
    .where(eq(marketplaceItems.id, id))
    .limit(1);
  if (!item) return Response.json({ error: 'item not found' }, { status: 404 });

  const version = body.version ?? `${Date.now()}`;
  const versionId = randomUUID();
  await db.insert(marketplaceVersions).values({
    id: versionId,
    itemId: id,
    version,
    manifest: serializeManifest(parsed.config),
    changelog: body.changelog,
  });
  await db
    .update(marketplaceItems)
    .set({ latestVersionId: versionId, updatedAt: new Date() })
    .where(eq(marketplaceItems.id, id));

  return Response.json({ id: versionId, version }, { status: 201 });
}
