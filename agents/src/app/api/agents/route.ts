import { NextResponse } from 'next/server';
import { listAgents } from '@/lib/agent-dir';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/agents —— 列出 .lhx-agent 下所有 agent（name + description）。 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ agents: await listAgents() });
}
