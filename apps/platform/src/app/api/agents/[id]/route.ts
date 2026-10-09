import type { NextRequest } from 'next/server';
import { getAgentBundle, updateAgentConfig } from '@/lib/agents-repo';
import { deleteAgentCascade } from '@/lib/marketplace-repo';
import { parseManifest } from '@/lib/manifest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/agents/:id —— 实例详情（含规则 / MCP / 文档清单）。 */
export async function GET(_request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const bundle = await getAgentBundle(id);
  if (!bundle) return Response.json({ error: 'agent not found' }, { status: 404 });
  return Response.json({
    agent: bundle.agent,
    rules: bundle.rules.map((rule) => ({ id: rule.ruleId, kind: rule.kind })),
    mcpServers: bundle.mcpServers.map((server) => server.name),
    documents: bundle.documents.map((doc) => doc.name),
  });
}

/** PATCH /api/agents/:id —— 覆写实例配置（不改动来源版本 manifest）。 */
export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { config?: unknown };
  const parsed = parseManifest(body.config);
  if (!parsed.ok) {
    return Response.json({ error: 'config 校验失败', issues: parsed.issues }, { status: 400 });
  }
  const row = await updateAgentConfig(
    id,
    JSON.parse(JSON.stringify(parsed.config)) as Record<string, unknown>,
  );
  if (!row) return Response.json({ error: 'agent not found' }, { status: 404 });
  return Response.json(row);
}

/**
 * DELETE /api/agents/:id —— 删除实例（含规则 / MCP / 文档子表）。
 * 引擎侧的会话历史**不级联删除**（按 agentName 存，删实例后仍可追溯）。
 */
export async function DELETE(_request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const ok = await deleteAgentCascade(id);
  if (!ok) return Response.json({ error: 'agent not found' }, { status: 404 });
  return Response.json({ ok: true });
}
