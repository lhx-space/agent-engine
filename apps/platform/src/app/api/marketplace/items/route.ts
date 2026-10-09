import type { NextRequest } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getPlatformDb } from '@/db/client';
import { marketplaceItems, marketplaceVersions } from '@/db/schema';
import { parseManifest, serializeManifest } from '@/lib/manifest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/marketplace/items —— 市场列表（可按 type 过滤）。 */
export async function GET(request: NextRequest): Promise<Response> {
  const type = request.nextUrl.searchParams.get('type');
  const db = getPlatformDb();
  const rows = type
    ? await db
        .select()
        .from(marketplaceItems)
        .where(eq(marketplaceItems.type, type))
        .orderBy(desc(marketplaceItems.updatedAt))
    : await db.select().from(marketplaceItems).orderBy(desc(marketplaceItems.updatedAt));
  return Response.json({ items: rows });
}

/**
 * POST /api/marketplace/items —— 上架（创建商品 + 首个版本）。
 * body: { type, slug, name, config, summary?, version? }
 * 第一版类型仅允许 `agent` / `skill`。
 */
export async function POST(request: NextRequest): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as {
    type?: string;
    slug?: string;
    name?: string;
    summary?: string;
    config?: unknown;
    version?: string;
  };

  if (body.type !== 'agent' && body.type !== 'skill') {
    return Response.json({ error: '第一版仅支持上架 agent / skill' }, { status: 400 });
  }
  const parsed = parseManifest(body.config);
  if (!parsed.ok) {
    return Response.json({ error: 'manifest 校验失败', issues: parsed.issues }, { status: 400 });
  }

  const db = getPlatformDb();
  const itemId = randomUUID();
  const versionId = randomUUID();
  const slug = body.slug ?? body.name ?? itemId;

  await db.insert(marketplaceItems).values({
    id: itemId,
    type: body.type,
    slug,
    name: body.name ?? slug,
    summary: body.summary,
    status: 'published',
    latestVersionId: versionId,
  });
  await db.insert(marketplaceVersions).values({
    id: versionId,
    itemId,
    version: body.version ?? '1.0.0',
    manifest: serializeManifest(parsed.config),
  });

  return Response.json({ id: itemId, versionId, slug }, { status: 201 });
}
