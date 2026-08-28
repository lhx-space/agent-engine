import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveAgentConfig } from '@lhx-agent-engine/core';
import {
  createPresetLongTermMemoryFactory,
  createPresetPluginFactories,
  defaultCapabilityPlugins,
} from '@lhx-agent-engine/preset-default';
import { createLocalHooksPlugin, scanAgentDir } from '@/lib/agent-dir';
import { providerFactory } from '@/lib/provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ name: string }>;
}

/**
 * POST /api/agent/:name/run
 * body: { "input": "..." }
 *
 * 扫 .lhx-agent/:name/ 目录 → 运行时构建 AgentConfig 协议 → 装配 → 运行。
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { name } = await context.params;

  const body = (await request.json().catch(() => ({}))) as { input?: unknown; apiKey?: unknown };
  const input = typeof body.input === 'string' ? body.input : '';
  if (!input) {
    return NextResponse.json({ error: 'input is required' }, { status: 400 });
  }
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey : '';

  try {
    const { config, hooks } = await scanAgentDir(name);
    if (apiKey) {
      config.model = { ...config.model, apiKey };
    }

    const pluginFactories = createPresetPluginFactories(config);
    if (hooks.length > 0) {
      pluginFactories['@local/hooks'] = () => createLocalHooksPlugin(hooks);
    }

    const resolved = await resolveAgentConfig(config, {
      pluginFactories,
      defaultPlugins: defaultCapabilityPlugins(config),
      longTermMemoryFactory: createPresetLongTermMemoryFactory(),
      providerFactory,
    });

    try {
      const result = await resolved.agent.run(input);
      return NextResponse.json(result);
    } finally {
      await resolved.dispose();
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
