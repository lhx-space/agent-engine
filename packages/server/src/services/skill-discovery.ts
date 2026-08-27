import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { parseInstalledSkills, parseSkillList } from '../utils/skill-list';
import type { ParsedSkill } from '../utils/skill-list';

const execFileAsync = promisify(execFile);

/** 从 skills.sh 发现的单个 skill（即 `parseSkillList` 的解析结果）。 */
export type DiscoveredSkill = ParsedSkill;

/** skill 发现依赖（命令执行可注入，便于测试）。 */
export interface SkillDiscovererDeps {
  /** 执行外部命令并返回 stdout。 */
  exec(command: string, args: string[]): Promise<{ stdout: string }>;
}

/** skill 发现能力：对接 skills.sh（`npx skills`）。 */
export interface SkillDiscoverer {
  /** 列出指定 `owner/repo` 里的 skills（`npx skills add <repo> -l`）。 */
  discover(repo: string): Promise<DiscoveredSkill[]>;
  /** 列出已安装 skill 名（`npx skills ls`，best-effort）。 */
  listInstalled(): Promise<string[]>;
  /** 安装一个 skill 到全局，返回其本地路径（`~/.agents/skills/<skill>`）。 */
  install(repo: string, skill: string): Promise<{ path: string }>;
}

async function defaultExec(command: string, args: string[]): Promise<{ stdout: string }> {
  return execFileAsync(command, args, { maxBuffer: 10 * 1024 * 1024 });
}

/** 默认实现：经 `npx skills` CLI 对接 skills.sh（复用官方技能生态，不自研 registry）。 */
export function createNpxSkillDiscoverer(deps?: SkillDiscovererDeps): SkillDiscoverer {
  const exec = deps?.exec ?? defaultExec;

  return {
    async discover(repo) {
      const { stdout } = await exec('npx', ['--yes', 'skills', 'add', repo, '-l']);
      return parseSkillList(stdout);
    },
    async listInstalled() {
      const { stdout } = await exec('npx', ['--yes', 'skills', 'ls', '-g']);
      return parseInstalledSkills(stdout);
    },
    async install(repo, skill) {
      await exec('npx', ['--yes', 'skills', 'add', repo, '-s', skill, '--copy', '-y', '-g']);
      return { path: join(homedir(), '.agents', 'skills', skill) };
    },
  };
}
