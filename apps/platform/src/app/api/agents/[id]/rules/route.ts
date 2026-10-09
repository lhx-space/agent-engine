import type { NextRequest } from 'next/server';
import { addAgentRule, deleteAgentRule, listAgentRules } from '@/lib/marketplace-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/agents/:id/rules —— 规则列表。 */
export async function GET(_request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return Response.json({ rules: await listAgentRules(id) });
}

/** POST /api/agents/:id/rules —— 新增规则（body: ruleId / kind / content / description? / tags?）。 */
export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    ruleId?: string;
    kind?: string;
    content?: string;
    description?: string;
    tags?: string[];
  };
  if (!body.ruleId || !body.content) {
    return Response.json({ error: 'ruleId 与 content 必填' }, { status: 400 });
  }
  const row = await addAgentRule({
    agentId: id,
    ruleId: body.ruleId,
    kind: body.kind ?? 'on-demand',
    content: body.content,
    description: body.description,
    tags: body.tags,
  });
  return Response.json(row, { status: 201 });
}

/** DELETE /api/agents/:id/rules?ruleId=xxx —— 删除规则。 */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const ruleId = request.nextUrl.searchParams.get('ruleId');
  if (!ruleId) return Response.json({ error: 'ruleId 必填' }, { status: 400 });
  const ok = await deleteAgentRule(id, ruleId);
  if (!ok) return Response.json({ error: 'rule not found' }, { status: 404 });
  return Response.json({ ok: true });
}
