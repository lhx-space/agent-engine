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
 * POST /api/agent/:name/run/stream
 * body: { "input": "..." }
 *
 * 流式 NDJSON：每行一个 AgentRunEvent（llm_delta / tool_call / done / …）。
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const { name } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { input?: unknown; apiKey?: unknown };
  const input = typeof body.input === 'string' ? body.input : '';
  if (!input) {
    return Response.json({ error: 'input is required' }, { status: 400 });
  }
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey : '';

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

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await resolved.agent.run(input, { onEvent: write });
      } finally {
        await resolved.dispose();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson',
      'cache-control': 'no-cache',
    },
  });
}
