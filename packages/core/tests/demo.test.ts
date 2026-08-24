import { describe, expect, it } from '@rstest/core';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import type { SecurityConfig } from '@agent-engine/config';
import { assembleAgentLoop } from '../src/agent/assemble';
import type { ChatCompletionResult, ChatMessage, LLMProvider } from '../src/llm/types';
import { ConversationMemory } from '../src/memory/conversation-memory';
import type { Plugin } from '../src/plugins/types';
import { createReadFileTool, createWriteFileTool } from '../src/tools/builtin/file';
import { ToolRegistry } from '../src/tools/registry';

function makeSecurity(workspaceRoot: string): SecurityConfig {
  return {
    sandbox: { backend: 'auto', image: 'agent-engine/sandbox' },
    bash: {
      enabled: false,
      allowCommands: [],
      denyPatterns: [],
      allowNetwork: false,
      timeoutMs: 30_000,
      maxOutputBytes: 65_536,
    },
    files: { roots: [workspaceRoot], maxFileBytes: 1_048_576 },
    webSearch: { provider: 'duckduckgo', maxResults: 8, timeoutMs: 10_000 },
    webFetch: { allowDomains: [], denyDomains: [], timeoutMs: 15_000, maxOutputBytes: 32_768 },
  };
}

/**
 * 端到端可观测 demo：mock LLM 跑通完整 Agent，
 * 用 console.log 打印「装配(plugin + 内置工具) → 内置工具执行(todo/read_file) → 检索(rules/skills) → 多轮回答」全流程。
 * 运行：pnpm test demo
 */
describe('端到端 demo（可观测）', () => {
  it('plugin + 内置工具装配 → todo/read_file 执行 → 多轮回答', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-demo-'));
    const notePath = path.join(dir, 'note.txt');
    await fs.writeFile(notePath, '北京近期降温，注意保暖。');
    try {
      // 1. 空工具注册表（tool 由 plugin + 内置工具注入）
      const registry = new ToolRegistry();

      // 2. 一个 plugin：注入 weather 工具 + prompt 片段
      const weatherPlugin: Plugin = {
        name: 'weather-plugin',
        description: '天气查询与穿衣建议',
        version: '1.0.0',
        install(ctx) {
          ctx.registerTool({
            name: 'get_weather',
            description: '查询城市天气',
            inputSchema: z.object({ city: z.string() }),
            execute: async (input: { city: string }) => ({
              city: input.city,
              temp: 22,
              condition: '晴',
            }),
          });
          ctx.provideSystemPrompt('你擅长天气查询，并给出穿衣建议。');
        },
      };

      // 3. mock LLM：todo 规划 → read_file → get_weather → 最终回答
      const todoCall: ChatMessage = {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'builtin.todo', arguments: '{"action":"add","task":"查询北京天气"}' },
          },
        ],
      };
      const readCall: ChatMessage = {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call_2',
            type: 'function',
            function: {
              name: 'builtin.read_file',
              arguments: JSON.stringify({ path: notePath }),
            },
          },
        ],
      };
      const weatherCall: ChatMessage = {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call_3',
            type: 'function',
            function: { name: 'get_weather', arguments: '{"city":"北京"}' },
          },
        ],
      };
      const responses: ChatCompletionResult[] = [
        { message: todoCall },
        { message: readCall },
        { message: weatherCall },
        { message: { role: 'assistant', content: '已按计划：北京今天 22 度，晴，建议穿薄外套。' } },
      ];
      let callIndex = 0;
      const provider: LLMProvider = {
        name: 'mock-deepseek',
        async chatCompletion(params) {
          const r = responses[Math.min(callIndex, responses.length - 1)];
          callIndex += 1;
          console.log(`\n── LLM 调用 #${callIndex}（发送 ${params.messages.length} 条消息）──`);
          for (const m of params.messages) {
            const preview = m.content.replace(/\n/g, ' ⏎ ').slice(0, 160);
            console.log(`  [${m.role}] ${preview}${m.content.length > 160 ? '…' : ''}`);
          }
          if (params.tools?.length) {
            console.log(
              '  可用工具:',
              params.tools.map((t) => t.function.name),
            );
          }
          return r;
        },
      };

      // 4. 装配：plugin + 声明式 rules + skills + memory + security(内置工具)
      const memory = new ConversationMemory({ maxMessages: 10 });
      const security = makeSecurity(dir);
      const { agent: loop } = await assembleAgentLoop({
        provider,
        registry,
        systemPrompt: {
          template: '你是 {{role}}。\n\n规则：\n{{rules}}\n\n技能：\n{{skills}}',
          variables: { role: '天气助手' },
        },
        rules: [
          { id: 'r-concise', kind: 'always', description: '简洁', content: '回答要简洁', tags: [] },
          {
            id: 'r-weather-format',
            kind: 'on-demand',
            description: '天气回答格式规范',
            content: '报温度时注明摄氏度单位。',
            tags: ['天气'],
          },
        ],
        skills: [
          {
            id: 'weather-qa',
            description: '天气查询与穿衣建议',
            instruction: '查询天气后，给出对应穿衣建议。',
            tags: ['天气', '穿衣'],
          },
        ],
        plugins: [
          weatherPlugin,
          {
            name: 'files-plugin',
            description: '本地文件读写',
            version: '1.0.0',
            install(ctx) {
              ctx.registerTool(createReadFileTool(security.files));
              ctx.registerTool(createWriteFileTool(security.files));
            },
          },
        ],
        memory,
        security,
      });

      console.log('\n========== 第一轮 ==========');
      const r1 = await loop.run('北京今天天气怎么样？');
      console.log('\n>> 第一轮最终回答:', r1.finalMessage.content);
      console.log('>> 步数:', r1.steps);

      console.log('\n========== 第二轮（多轮记忆） ==========');
      const r2 = await loop.run('那适合穿什么？');
      console.log('\n>> 第二轮最终回答:', r2.finalMessage.content);
      console.log('>> 会话记忆条数:', memory.size);

      // 内置工具（todo 恒注册 + read_file 按引用）+ plugin 工具均已装配；bash 未启用。
      expect(registry.has('builtin.todo')).toBe(true);
      expect(registry.has('builtin.read_file')).toBe(true);
      expect(registry.has('builtin.bash')).toBe(false);
      expect(registry.has('get_weather')).toBe(true);
      expect(r1.finalMessage.content).toContain('22');
      expect(r2.steps).toBeGreaterThan(0);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
