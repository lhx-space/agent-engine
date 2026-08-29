import { describe, expect, it } from '@rstest/core';
import { createNpxSkillDiscoverer } from '../src/services/skill-discovery';
import { parseInstalledSkills, parseSkillList, stripAnsi } from '../src/utils/skill-list';

describe('stripAnsi', () => {
  it('剥离色码与 TUI 控制序列', () => {
    const input = `\x1b[38;5;250m${'hello'}\x1b[0m \x1b[?25l${'world'}\x1b[?25h`;
    expect(stripAnsi(input)).toBe('hello world');
  });
});

describe('parseSkillList', () => {
  it('解析 npx skills add -l 输出为 skill 列表', () => {
    const output = [
      '\x1b[1mSkills\x1b[0m',
      '│',
      '│  Tip: use --yes',
      '◇  Available Skills',
      '│',
      '│    vercel-react-best-practices',
      '│',
      '│      React and Next.js performance guidelines.',
      '│',
      '│    deploy-to-vercel',
      '│',
      '│      Deploy applications to Vercel.',
    ].join('\n');

    expect(parseSkillList(output)).toEqual([
      {
        name: 'vercel-react-best-practices',
        description: 'React and Next.js performance guidelines.',
      },
      { name: 'deploy-to-vercel', description: 'Deploy applications to Vercel.' },
    ]);
  });
});

describe('parseInstalledSkills', () => {
  it('解析 npx skills ls -g 输出为已装 skill 名列表', () => {
    const output = [
      '\x1b[1mGlobal Skills\x1b[0m',
      '',
      `\x1b[36m${'deploy-to-vercel'}\x1b[0m \x1b[38;5;102m~/.agents/skills/deploy-to-vercel\x1b[0m`,
      '  \x1b[38;5;102mAgents:\x1b[0m Claude Code  \x1b[38;5;102mSource:\x1b[0m vercel-labs/agent-skills',
      `\x1b[36m${'find-skills'}\x1b[0m \x1b[38;5;102m~/.agents/skills/find-skills\x1b[0m`,
      '  \x1b[38;5;102mAgents:\x1b[0m CodeBuddy  \x1b[38;5;102mSource:\x1b[0m vercel-labs/skills',
    ].join('\n');

    expect(parseInstalledSkills(output)).toEqual(['deploy-to-vercel', 'find-skills']);
  });
});

describe('createNpxSkillDiscoverer', () => {
  it('discover 调 npx skills add -l 并解析', async () => {
    const calls: string[][] = [];
    const discoverer = createNpxSkillDiscoverer({
      exec: async (_command, args) => {
        calls.push(args);
        return { stdout: '│    my-skill\n│\n│      does things' };
      },
    });

    const skills = await discoverer.discover('vercel-labs/agent-skills');
    expect(calls[0]).toEqual(['--yes', 'skills', 'add', 'vercel-labs/agent-skills', '-l']);
    expect(skills).toEqual([{ name: 'my-skill', description: 'does things' }]);
  });

  it('install 调 npx skills add -s <skill> 并返回本地路径', async () => {
    const calls: string[][] = [];
    const discoverer = createNpxSkillDiscoverer({
      exec: async (_command, args) => {
        calls.push(args);
        return { stdout: '' };
      },
    });

    const result = await discoverer.install('vercel-labs/agent-skills', 'deploy-to-vercel');
    expect(calls[0]).toEqual([
      '--yes',
      'skills',
      'add',
      'vercel-labs/agent-skills',
      '-s',
      'deploy-to-vercel',
      '--copy',
      '-y',
      '-g',
    ]);
    expect(result.path).toContain('.agents/skills/deploy-to-vercel');
  });

  it('listInstalled 调 npx skills ls -g 并解析为 skill 名', async () => {
    const calls: string[][] = [];
    const discoverer = createNpxSkillDiscoverer({
      exec: async (_command, args) => {
        calls.push(args);
        return {
          stdout:
            'Global Skills\n\ndeploy-to-vercel ~/.agents/skills/deploy-to-vercel\n  Agents: Claude Code Source: vercel-labs/agent-skills',
        };
      },
    });

    const skills = await discoverer.listInstalled();
    expect(calls[0]).toEqual(['--yes', 'skills', 'ls', '-g']);
    expect(skills).toEqual(['deploy-to-vercel']);
  });
});
