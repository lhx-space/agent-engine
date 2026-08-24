import type { AgentConfig } from '@agent-engine/config/schema';

export interface AgentRunResult {
  finalMessage: { content: string };
  steps: number;
}

/** 调用 server 的 `/api/agent/run`，失败抛含 `details`/`error` 的错误。 */
export async function runAgent(config: AgentConfig, input: string): Promise<AgentRunResult> {
  const res = await fetch('/api/agent/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ config, input }),
  });

  const body = (await res.json()) as unknown;
  if (!res.ok) {
    const err = body as { error?: string; details?: string };
    throw new Error(err.details ?? err.error ?? `HTTP ${res.status}`);
  }
  return body as AgentRunResult;
}
