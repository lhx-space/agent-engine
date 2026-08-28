import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';
import type { SkillRef } from '@lhx-agent-engine/config';
import type { ContextContributor } from '@lhx-agent-engine/core/context';
import type { PluginContext } from '@lhx-agent-engine/core/plugins';
import { createSkillsPlugin, loadSkillFromPath, resolveSkill, resolveSkills } from '../src/index';
import type { Skill, SkillSourceDeps } from '../src/index';

function makeCtx(): { ctx: PluginContext; contributors: ContextContributor[] } {
  const contributors: ContextContributor[] = [];
  const ctx = {
    registerContextContributor: (contributor: ContextContributor) => contributors.push(contributor),
  } as PluginContext;
  return { ctx, contributors };
}

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

describe('createSkillsPlugin', () => {
  it('安装后注册 ContextContributor', async () => {
    const { ctx, contributors } = makeCtx();
    await createSkillsPlugin([incidentSkill, k8sSkill]).install(ctx);
    expect(contributors).toHaveLength(1);
    expect(contributors[0]?.name).toBe('@lhx-agent-engine/plugin-skills');
  });

  it('检索命中注入 instruction 文本', async () => {
    const { ctx, contributors } = makeCtx();
    await createSkillsPlugin([incidentSkill, k8sSkill]).install(ctx);
    const contribution = await contributors[0]!.contribute({ userInput: '线上出事故了，怎么处理' });
    expect(contribution?.text).toContain('先止损');
    expect(contribution?.text).toContain('incident-response');
  });

  it('命中带工具的 skill 时返回捆绑工具', async () => {
    const { ctx, contributors } = makeCtx();
    await createSkillsPlugin([k8sSkill]).install(ctx);
    const contribution = await contributors[0]!.contribute({ userInput: '帮我诊断 k8s 集群故障' });
    expect(contribution?.text).toContain('get events');
    expect(contribution?.tools?.map((t) => t.name)).toEqual(['kubectl']);
  });

  it('不相关不召回', async () => {
    const { ctx, contributors } = makeCtx();
    await createSkillsPlugin([incidentSkill]).install(ctx);
    const contribution = await contributors[0]!.contribute({ userInput: '今天天气如何' });
    expect(contribution).toBeUndefined();
  });

  it('空技能返回空贡献', async () => {
    const { ctx, contributors } = makeCtx();
    await createSkillsPlugin([]).install(ctx);
    const contribution = await contributors[0]!.contribute({ userInput: '任意 query' });
    expect(contribution).toBeUndefined();
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

    expect(skill.id).toBe('incident-response');
    expect(skill.description).toBe('事故响应');
    expect(skill.tags).toEqual(['oncall']);
    expect(skill.instruction).toContain('先止损');
  });
});

describe('resolveSkill（来源解析）', () => {
  function fakeDeps(): SkillSourceDeps & { executed: string[] } {
    const executed: string[] = [];
    return {
      executed,
      async exec(command, args) {
        executed.push([command, ...args].join(' '));
      },
      async mkdtemp() {
        return '/tmp/fake-skill';
      },
      async rm() {},
      async readSkill(dir) {
        return { id: dir, description: 'd', instruction: 'i', tags: [] };
      },
    };
  }

  it('path 来源直接 readSkill 且无 dispose 副作用', async () => {
    const deps = fakeDeps();
    const ref: SkillRef = { source: 'path', path: './skills/x' };
    const { skill, dispose } = await resolveSkill(ref, deps);
    expect(skill.id).toBe('./skills/x');
    expect(deps.executed).toEqual([]);
    await dispose();
  });

  it('git 来源执行 clone，ref 存在时加 --branch', async () => {
    const deps = fakeDeps();
    const ref: SkillRef = { source: 'git', url: 'https://x/y', ref: 'main' };
    await resolveSkill(ref, deps);
    expect(deps.executed).toContain(
      'git clone --depth 1 --branch main https://x/y /tmp/fake-skill',
    );
  });

  it('resolveSkills 批量解析并聚合 dispose', async () => {
    const deps = fakeDeps();
    const refs: SkillRef[] = [
      { source: 'path', path: './a' },
      { source: 'path', path: './b' },
    ];
    const { skills, dispose } = await resolveSkills(refs, deps);
    expect(skills.map((s) => s.id)).toEqual(['./a', './b']);
    await dispose();
  });
});
