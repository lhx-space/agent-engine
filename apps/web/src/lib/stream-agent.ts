import type { AgentConfig } from '@lhx-agent-engine/config/schema';

/** 与后端 `AgentRunEvent` 对齐的最小事件契约（web 不能 import core）。 */
export type StreamEvent =
  | { type: 'step_start'; step: number }
  | { type: 'llm_delta'; delta: string; kind?: 'reasoning' | 'content' }
  | { type: 'tool_call'; name: string; args: string }
  | { type: 'tool_result'; name: string; result: string }
  | { type: 'hook'; trace: { hook: string; point: string; durationMs: number; changed: boolean } }
  | { type: 'done'; finalMessage: { content: string }; steps: number }
  | { type: 'error'; error: string };

export interface StreamAgentResult {
  /** 最终完整内容（若流正常结束且有 done 事件），否则空串。 */
  content: string;
  /** 服务端返回的会话 id（经 `x-session-id` 头），供后续多轮复用。 */
  sessionId: string | null;
}

/**
 * 流式调用 `/api/agent/run/stream`，按行解析 NDJSON 事件流。
 * - `onEvent` 每个事件触发一次；
 * - `signal` 用于中断（AbortController）；
 * - `sessionId` 传入已存在的会话 id，实现多轮复用。
 */
export async function streamAgent(
  config: AgentConfig,
  input: string,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
  sessionId?: string,
): Promise<StreamAgentResult> {
  const res = await fetch('/api/agent/run/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ config, input, sessionId }),
    signal,
  });

  if (!res.ok || !res.body) {
    // 4xx / 5xx（如 invalid config）是 JSON，不是 NDJSON。
    let details = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { details?: string; error?: string };
      details = body.details ?? body.error ?? details;
    } catch {
      // 非 JSON，保持 HTTP 状态。
    }
    throw new Error(details);
  }

  const newSessionId = res.headers.get('x-session-id');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalContent = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // 按行切分：遇到 \n 才解析一行，半个 JSON 行留在 buffer 等下一 chunk。
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;
      try {
        const event = JSON.parse(line) as StreamEvent;
        onEvent(event);
        if (event.type === 'done') {
          finalContent = event.finalMessage.content;
        }
      } catch {
        // 非法行跳过（防御），不中断整条流。
      }
    }
  }

  return { content: finalContent, sessionId: newSessionId };
}
