import type { AgentConfig } from '@lhx-agent-engine/config';

/** 与内核 `AgentRunEvent` 对齐的最小事件契约（前端不 import core）。 */
export type StreamEvent =
  | { type: 'step_start'; step: number }
  | { type: 'llm_delta'; delta: string; kind?: 'reasoning' | 'content' }
  | { type: 'tool_call'; name: string; args: string }
  | { type: 'tool_result'; name: string; result: string }
  | { type: 'hook'; trace: { hook: string; point: string; durationMs: number; changed: boolean } }
  | { type: 'done'; finalMessage: { content: string }; steps: number }
  | { type: 'session'; sessionId: string; persisted: boolean }
  | { type: 'error'; error: string };

export interface StreamHandle {
  /** 会话 id（首轮由服务端生成并回传，后续沿用）。 */
  sessionId: string;
}

/**
 * 发起一次流式运行，逐行（NDJSON）回调事件。
 * 会话 id 经 `x-session-id` 请求头传入与回传，与自托管宿主、原 apps/web 一致。
 */
export async function streamAgentRun(
  url: string,
  body: { input: string; sessionId?: string },
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<StreamHandle> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(body.sessionId ? { 'x-session-id': body.sessionId } : {}),
    },
    body: JSON.stringify({ input: body.input }),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status}`);
  }

  const sessionId = response.headers.get('x-session-id') ?? body.sessionId ?? '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as StreamEvent);
    }
  }

  return { sessionId };
}

/** 平台运行接口的路径（供前端拼装）。 */
export function agentRunUrl(agentId: string, stream = false): string {
  return `/api/agents/${agentId}/run${stream ? '/stream' : ''}`;
}

/** 配置是否声明了持久化会话存储（决定历史能否跨请求保留）。 */
export function isPersistent(config: AgentConfig): boolean {
  return config.session?.store === 'pg';
}
