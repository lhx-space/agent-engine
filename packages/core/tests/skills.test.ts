import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';
import { AgentLoop } from '../src/agent/loop';
import { buildSystemPrompt } from '../src/context/build-system-prompt';
import type { ChatMessage, LLMProvider } from '../src/llm/types';
import { CapabilityLoader } from '../src/retrieval/loader';
import { loadSkillFromPath } from '../src/skills/load';
import type { Skill } from '../src/skills/types';
import { ToolRegistry } from '../src/tools/registry';

const incidentSkill: Skill = {
  id: 'incident-response',
  description: '事故响应流程',
  instruction: '当发生线上事故时：先止损 → 定位 → 修复 → 复盘。',
  tags: ['oncall', 'incident'],
};

const k8sSkill: Skill = {
  id: 'k8s-diagnosis',
  description: 'Kubernetes 故障诊断',
  instruction: '排查顺序：get events → describe pod → logs。',
  tags: ['k8s', 'kubernetes'],
  tools: [
    {
      name: 'kubectl',
      description: '执行 kubectl 命令',
      inputSchema: z.object({ cmd: z.string() }),
      execute: async (input: { cmd: string }) => ({ output: `executed: ${input.cmd}` }),
    },
  ],
};

describe('CapabilityLoader<Skill>', () => {
  it('关键词召回含 score', () => {
    const loader = new CapabilityLoader<Skill>('skill', [incidentSkill, k8sSkill]);
    const hits = loader.loadForQuery('线上出事故了，怎么处理', 5);

    console.log(
      '\n[CapabilityLoader] 命中的 skills:',
      hits.map((h) => `${h.record.id} (score=${h.score.toFixed(3)})`),
    );

    expect(hits[0]?.record.id).toBe('incident-response');
    expect(hits[0]?.score).toBeGreaterThan(0);
  });

  it('不相关不召回', () => {
    const loader = new CapabilityLoader<Skill>('skill', [incidentSkill]);
    const hits = loader.loadForQuery('今天天气如何', 5);

    expect(hits).toEqual([]);
  });
});

describe('loadSkillFromPath', () => {
  it('解析 frontmatter 与正文', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'skill-'));
    const file = join(dir, 'SKILL.md');
    await writeFile(
      file,
      '---\nname: incident-response\ndescription: 事故响应\ntags:\n  - oncall\n---\n# 事故响应\n先止损，再定位。\n',
    );

    const skill = await loadSkillFromPath(file);
    console.log(
      '\n[loadSkillFromPath]',
      JSON.stringify(
        {
          id: skill.id,
          description: skill.description,
          tags: skill.tags,
          instruction: skill.instruction,
        },
        null,
        2,
      ),
    );

    expect(skill.id).toBe('incident-response');
    expect(skill.description).toBe('事故响应');
    expect(skill.tags).toEqual(['oncall']);
    expect(skill.instruction).toContain('先止损');
  });
});

describe('buildSystemPrompt {{skills}}', () => {
  it('注入 skills 指令', () => {
    const prompt = buildSystemPrompt({
      systemPrompt: { template: '你是 SRE。\n技能：\n{{skills}}' },
      skillsText: '## incident-response\n先止损 → 定位 → 修复。',
    });

    console.log('\n[buildSystemPrompt] 组装结果：\n' + prompt);

    expect(prompt).toContain('先止损');
    expect(prompt).not.toContain('{{skills}}');
  });
});

describe('AgentLoop skill 集成', () => {
  it('命中带工具的 skill：注入指令 + 注册捆绑工具 + run 结束清理', async () => {
    const registry = new ToolRegistry();
    const captured: ChatMessage[][] = [];
    const capturedTools: string[][] = [];
    const provider: LLMProvider = {
      name: 'mock',
      async chatCompletion(params) {
        captured.push(params.messages);
        capturedTools.push((params.tools ?? []).map((t) => t.function.name));
        return { message: { role: 'assistant', content: 'done' } };
      },
    };

    const loop = new AgentLoop({
      provider,
      registry,
      systemPrompt: { template: '你是 SRE。\n技能：\n{{skills}}' },
      skills: [incidentSkill, k8sSkill],
    });

    await loop.run('帮我诊断 k8s 集群故障');

    const systemMsg = captured[0]?.find((m) => m.role === 'system');
    console.log('\n[AgentLoop skill] system prompt：\n' + systemMsg?.content);

    expect(systemMsg?.content).toContain('get events');
    // 本轮 LLM 调用能看到 kubectl 工具定义。
    expect(capturedTools[0]).toContain('kubectl');
    // run 结束后清理：kubectl 不再残留于 registry（避免跨 run 工具面膨胀）。
    expect(registry.has('kubectl')).toBe(false);
  });
});
