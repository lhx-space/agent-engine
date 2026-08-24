import { useCallback, useRef, useState } from 'react';
import type { AgentConfig } from '@agent-engine/config/schema';
import { streamAgent, type StreamEvent } from '../lib/stream-agent';

/** 一条步骤（tool 调用 / hook 执行），用于「把每一步清晰化」。 */
export interface ChatStep {
  key: string;
  title: string;
  detail: string;
  kind: 'tool' | 'hook' | 'system';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** assistant 消息的运行状态。 */
  status: 'streaming' | 'done' | 'error';
  steps: ChatStep[];
  error?: string;
}

let messageSeq = 0;
const nextId = () => `m${++messageSeq}`;

export interface UseStreamChatReturn {
  messages: ChatMessage[];
  running: boolean;
  send: (input: string) => void;
  stop: () => void;
}

/**
 * 流式对话状态机：多轮消息 + 运行中的 assistant 消息。
 * 流式文本经 buffer + rAF 节流 flush（每帧最多一次 setState）。
 */
export function useStreamChat(config: AgentConfig): UseStreamChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (!trimmed || running) return;

      const controller = new AbortController();
      abortRef.current = controller;

      const userMessage: ChatMessage = {
        id: nextId(),
        role: 'user',
        content: trimmed,
        status: 'done',
        steps: [],
      };
      const assistantId = nextId();

      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: 'assistant', content: '', status: 'streaming', steps: [] },
      ]);
      setRunning(true);

      // 累积完整文本（供最终态），与「节流后的渲染状态」分离（双状态模型）。
      let pendingContent = '';
      let pendingSteps: ChatStep[] = [];
      let rafId = 0;
      let lastError: string | undefined;
      let finished = false;

      const flush = () => {
        rafId = 0;
        const content = pendingContent;
        const steps = pendingSteps;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content, steps, error: lastError } : m)),
        );
      };

      const scheduleFlush = () => {
        if (rafId !== 0) return; // 本帧已调度，合并。
        rafId = requestAnimationFrame(flush);
      };

      const onEvent = (event: StreamEvent) => {
        switch (event.type) {
          case 'step_start':
            pendingSteps = [
              ...pendingSteps,
              { key: `s${event.step}`, title: `第 ${event.step} 步`, detail: '', kind: 'system' },
            ];
            break;
          case 'llm_delta':
            pendingContent += event.delta;
            scheduleFlush();
            break;
          case 'tool_call':
            pendingSteps = [
              ...pendingSteps,
              {
                key: `t${event.name}-${pendingSteps.length}`,
                title: `调用工具 ${event.name}`,
                detail: event.args,
                kind: 'tool',
              },
            ];
            break;
          case 'tool_result':
            pendingSteps = [
              ...pendingSteps,
              {
                key: `r${event.name}-${pendingSteps.length}`,
                title: `工具结果 ${event.name}`,
                detail: event.result,
                kind: 'tool',
              },
            ];
            break;
          case 'hook':
            pendingSteps = [
              ...pendingSteps,
              {
                key: `h${event.trace.point}-${pendingSteps.length}`,
                title: `hook ${event.trace.hook} @ ${event.trace.point}`,
                detail: `${event.trace.durationMs.toFixed(1)}ms · ${event.trace.changed ? '已改写' : '仅观察'}`,
                kind: 'hook',
              },
            ];
            break;
          case 'done':
            pendingContent = event.finalMessage.content;
            finished = true;
            break;
          case 'error':
            lastError = event.error;
            finished = true;
            break;
        }
        // 步骤事件不触发文本渲染节流，但也要反映到 UI（低频，直接 schedule）。
        if (event.type !== 'llm_delta') scheduleFlush();
      };

      void (async () => {
        try {
          const content = await streamAgent(config, trimmed, onEvent, controller.signal);
          // done 事件已设置 pendingContent；若异常中断没有 done，用 streamAgent 返回值兜底。
          if (!finished && content) pendingContent = content;
        } catch (error) {
          if (controller.signal.aborted) {
            lastError = '已停止';
          } else {
            lastError = error instanceof Error ? error.message : String(error);
          }
        } finally {
          if (rafId !== 0) {
            cancelAnimationFrame(rafId);
            rafId = 0;
          }
          flush();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: pendingContent,
                    steps: pendingSteps,
                    status: lastError ? 'error' : 'done',
                    error: lastError,
                  }
                : m,
            ),
          );
          setRunning(false);
          abortRef.current = null;
        }
      })();
    },
    [config, running],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, running, send, stop };
}
