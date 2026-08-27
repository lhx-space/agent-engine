import { describe, expect, it, rs } from '@rstest/core';
import { z } from 'zod';
import { AgentLoop } from '../src/agent/loop';
import type { GuardrailRule } from '../src/guardrails';
import type { ChatCompletionResult, ChatMessage, LLMProvider } from '../src/llm/types';
import { ToolRegistry } from '../src/tools/registry';

function makeProvider(responses: ChatCompletionResult[]): LLMProvider {
  let i = 0;
  return {
    name: 'mock',
    async chatCompletion() {
      const r = responses[Math.min(i, responses.length - 1)];
      i += 1;
      return r as ChatCompletionResult;
    },
  };
}

function makeBashTool() {
  return {
    name: 'bash',
    description: 'run command',
    inputSchema: z.object({ cmd: z.string() }),
    execute: rs.fn(async () => ({ ok: true })),
  };
}

function bashCall(cmd: string): ChatMessage {
  return {
    role: 'assistant',
    content: '',
    toolCalls: [
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'bash', arguments: JSON.stringify({ cmd }) },
      },
    ],
  };
}

describe('guardrail 拦截（协议：GuardrailRule[]）', () => {
  it('beforeToolCall 阻断：工具不执行、回填 Blocked、循环继续', async () => {
    const tools = new ToolRegistry();
    const bash = makeBashTool();
    tools.register(bash);

    const rule: GuardrailRule = {
      id: 'no-rm',
      on: 'beforeToolCall',
      validate: async (ctx) => {
        if (ctx.args?.includes('rm -rf')) {
          return { allowed: false, reason: '破坏性命令被禁止' };
        }
        return { allowed: true };
      },
    };

    const provider = makeProvider([
      { message: bashCall('rm -rf /') },
      { message: { role: 'assistant', content: 'ok' } },
    ]);
    const loop = new AgentLoop({
      provider,
      registry: tools,
      systemPrompt: 's',
      guardrails: [rule],
    });

    const result = await loop.run('x');

    expect(bash.execute).not.toHaveBeenCalled();
    const toolMsg = result.messages.find((m) => m.role === 'tool');
    expect(toolMsg?.content).toContain('Blocked: 破坏性命令被禁止');
    expect(result.finalMessage.content).toBe('ok');
  });

  it('beforeToolCall 放行：工具正常执行', async () => {
    const tools = new ToolRegistry();
    const bash = makeBashTool();
    tools.register(bash);

    const rule: GuardrailRule = {
      id: 'no-rm',
      on: 'beforeToolCall',
      validate: async (ctx) =>
        ctx.args?.includes('rm -rf')
          ? { allowed: false, reason: '破坏性命令被禁止' }
          : { allowed: true },
    };

    const provider = makeProvider([
      { message: bashCall('ls -la') },
      { message: { role: 'assistant', content: 'done' } },
    ]);
    const loop = new AgentLoop({
      provider,
      registry: tools,
      systemPrompt: 's',
      guardrails: [rule],
    });

    const result = await loop.run('x');

    expect(bash.execute).toHaveBeenCalledTimes(1);
    const toolMsg = result.messages.find((m) => m.role === 'tool');
    expect(toolMsg?.content).toBe('{"ok":true}');
  });

  it('afterToolCall guardrail：阻断则替换结果', async () => {
    const tools = new ToolRegistry();
    tools.register({
      name: 'read_file',
      description: 'read file',
      inputSchema: z.object({ path: z.string() }),
      execute: rs.fn(async () => ({ content: 'secret data' })),
    });

    const rule: GuardrailRule = {
      id: 'redact-secret',
      on: 'afterToolCall',
      validate: async (ctx) =>
        ctx.result?.includes('secret')
          ? { allowed: false, reason: '结果含敏感信息' }
          : { allowed: true },
    };

    const readCall: ChatMessage = {
      role: 'assistant',
      content: '',
      toolCalls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'read_file', arguments: '{"path":"/etc/passwd"}' },
        },
      ],
    };

    const provider = makeProvider([
      { message: readCall },
      { message: { role: 'assistant', content: 'done' } },
    ]);
    const loop = new AgentLoop({
      provider,
      registry: tools,
      systemPrompt: 's',
      guardrails: [rule],
    });

    const result = await loop.run('x');

    const toolMsg = result.messages.find((m) => m.role === 'tool');
    expect(toolMsg?.content).toContain('Blocked: 结果含敏感信息');
  });
});
