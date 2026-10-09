import { listInstallations } from '@/lib/marketplace-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/installations —— 安装列表。 */
export async function GET(): Promise<Response> {
  return Response.json({ installations: await listInstallations() });
}
