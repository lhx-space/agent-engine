import { describe, expect, it, rs } from '@rstest/core';
import { z } from 'zod';
import { AgentConfigSchema, type AgentConfig } from '@agent-engine/config';
import { resolveAgentConfig } from '../src/resolve/resolve';
import type { AgentRunEvent, ChatMessage, LLMProvider } from '../src';

// ---- 可编程的流式 mock provider ----

interface ScriptedStep {
  /** 流式文本分片（依次 onDelta）。 */
  deltas?: string[];
  /** 最终完整结果（含 toolCalls 则触发工具执行）。 */
  message: { content: string; toolCalls?: { id: string; name: string; args: unknown }[] };
}

function makeScriptedProvider(steps: ScriptedStep[], captured?: string[][]): LLMProvider {
  let callIndex = 0;
  return {
    name: 'scripted',
    async chatCompletionStream(_params, onDelta) {
      const step = steps[callIndex++] ?? { message: { content: '' } };
      for (const delta of step.deltas ?? []) onDelta(delta);
      captured?.push(step.deltas ?? []);
      return {
        message: {
          role: 'assistant',
          content: step.message.content,
          toolCalls: step.message.toolCalls?.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
          })),
        },
      };
    },
  };
}

function makeConfig(): AgentConfig {
  return AgentConfigSchema.parse({
    name: 'stream-test',
    model: { provider: 'custom', baseURL: 'http://localhost', model: 'mock', apiKey: 'x' },
    systemPrompt: { template: '你是助手' },
    tools: [{ use: 'builtin.todo' }],
  });
}

describe('AgentLoop 运行时事件流', () => {
  it('文本分片经 llm_delta 逐步产出，最终 done', async () => {
    const captured: string[][] = [];
    const config = makeConfig();
    const events: AgentRunEvent[] = [];
    const resolved = await resolveAgentConfig(config, {
      providerFactory: () =>
        makeScriptedProvider(
          [{ deltas: ['你', '好', '！'], message: { content: '你好！' } }],
          captured,
        ),
    });

    await resolved.agent.run('hi', { onEvent: (event) => events.push(event) });
    await resolved.dispose();

    expect(captured).toEqual([['你', '好', '！']]);
    expect(events.map((e) => e.type)).toEqual([
      'step_start',
      'llm_delta',
      'llm_delta',
      'llm_delta',
      'done',
    ]);
    expect(
      events.filter((e) => e.type === 'llm_delta').map((e) => (e as { delta: string }).delta),
    ).toEqual(['你', '好', '！']);
    const done = events.find((e) => e.type === 'done');
    expect(done && (done as { finalMessage: ChatMessage }).finalMessage.content).toBe('你好！');
  });

  it('工具调用步骤产出 tool_call / tool_result 事件', async () => {
    const config = makeConfig();
    // 第一步：模型发起 tool call；第二步：模型给出最终回答。
    const events: AgentRunEvent[] = [];
    const resolved = await resolveAgentConfig(config, {
      providerFactory: () =>
        makeScriptedProvider([
          {
            deltas: [],
            message: {
              content: '',
              toolCalls: [{ id: 'c1', name: 'builtin_todo', args: { action: 'list' } }],
            },
          },
          { deltas: ['done'], message: { content: 'done' } },
        ]),
    });

    await resolved.agent.run('plan', { onEvent: (event) => events.push(event) });
    await resolved.dispose();

    const types = events.map((e) => e.type);
    expect(types).toContain('tool_call');
    expect(types).toContain('tool_result');
    const toolCall = events.find((e) => e.type === 'tool_call') as { name: string } | undefined;
    expect(toolCall?.name).toBe('builtin.todo');
    expect(types[types.length - 1]).toBe('done');
  });

  it('无 onEvent 时行为与非流式一致', async () => {
    const config = makeConfig();
    const resolved = await resolveAgentConfig(config, {
      providerFactory: () => makeScriptedProvider([{ deltas: ['ok'], message: { content: 'ok' } }]),
    });

    const result = await resolved.agent.run('hi');
    expect(result.finalMessage.content).toBe('ok');
    await resolved.dispose();
  });
});

describe('ToolRegistry 事件名与工具名（流式场景）', () => {
  it('tool_call 事件用语义名（builtin.todo），非 LLM 合法名', async () => {
    const config = makeConfig();
    const events: AgentRunEvent[] = [];
    const resolved = await resolveAgentConfig(config, {
      providerFactory: () =>
        makeScriptedProvider([
          {
            message: {
              content: '',
              toolCalls: [{ id: 'c1', name: 'builtin_todo', args: { action: 'list' } }],
            },
          },
          { message: { content: 'ok' } },
        ]),
    });

    await resolved.agent.run('x', { onEvent: (event) => events.push(event) });
    await resolved.dispose();

    const toolCall = events.find((e) => e.type === 'tool_call') as { name: string } | undefined;
    // LLM 回调合法名 builtin_todo，但事件里反查回语义名 builtin.todo。
    expect(toolCall?.name).toBe('builtin.todo');
  });
});

describe('mock provider 无流式方法时回退', () => {
  it('非流式 provider 仍可用（无 llm_delta 事件）', async () => {
    const config = makeConfig();
    const events: AgentRunEvent[] = [];
    const provider: LLMProvider = {
      name: 'non-stream',
      async chatCompletion() {
        return { message: { role: 'assistant', content: 'plain' } };
      },
    };
    const resolved = await resolveAgentConfig(config, { providerFactory: () => provider });

    await resolved.agent.run('hi', { onEvent: (event) => events.push(event) });
    await resolved.dispose();

    expect(events.some((e) => e.type === 'llm_delta')).toBe(false);
    expect(events[events.length - 1]?.type).toBe('done');
  });
});
