import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { SkillRef } from '@agent-engine/config';
import { loadSkillFromPath } from '../skills/load';
import type { Skill } from '../skills/types';
import type { SkillSourceDeps } from './types';

const execFileAsync = promisify(execFile);

/** 默认依赖：真实执行 npm / git / tar 命令 + 系统临时目录。 */
export function createDefaultSkillSourceDeps(): SkillSourceDeps {
  return {
    async exec(command, args, options) {
      await execFileAsync(command, args, { ...(options?.cwd ? { cwd: options.cwd } : {}) });
    },
    async mkdtemp() {
      return mkdtemp(join(tmpdir(), 'agent-engine-skill-'));
    },
    async rm(dir) {
      await rm(dir, { recursive: true, force: true });
    },
    async readSkill(dir) {
      // 递归定位 SKILL.md（优先根目录，其次一层子目录）。
      const candidates: string[] = [join(dir, 'SKILL.md')];
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          candidates.push(join(dir, entry.name, 'SKILL.md'));
        }
      }
      for (const candidate of candidates) {
        try {
          await fs.access(candidate);
          return await loadSkillFromPath(candidate);
        } catch {
          // 继续找下一个候选。
        }
      }
      throw new Error(`Skill source resolved to "${dir}" but no SKILL.md found`);
    },
  };
}

export interface ResolvedSkill {
  skill: Skill;
  /** 释放拉取来源占用的临时资源（path 来源无副作用）。 */
  dispose(): Promise<void>;
}

/** 解析单个技能来源 → Skill（path 直读 / npm 拉包 / git clone）。 */
export async function resolveSkill(
  ref: SkillRef,
  deps: SkillSourceDeps = createDefaultSkillSourceDeps(),
): Promise<ResolvedSkill> {
  switch (ref.source) {
    case 'path': {
      return {
        skill: await deps.readSkill(ref.path),
        dispose: async () => {},
      };
    }
    case 'npm': {
      const dir = await deps.mkdtemp();
      const spec = ref.version ? `${ref.package}@${ref.version}` : ref.package;
      try {
        // npm pack → tgz 落盘 → tar 解包（复用系统二进制，不自研解包）。
        await deps.exec('npm', ['pack', spec, '--pack-destination', dir]);
        const files = await fs.readdir(dir);
        const tgz = files.find((f) => f.endsWith('.tgz'));
        if (!tgz) throw new Error(`npm pack "${spec}" produced no tarball`);
        await deps.exec('tar', ['-xzf', join(dir, tgz), '-C', dir]);
        return {
          skill: await deps.readSkill(dir),
          dispose: () => deps.rm(dir),
        };
      } catch (error) {
        await deps.rm(dir).catch(() => {});
        throw error;
      }
    }
    case 'git': {
      const dir = await deps.mkdtemp();
      try {
        const args = ['clone', '--depth', '1'];
        if (ref.ref) args.push('--branch', ref.ref);
        args.push(ref.url, dir);
        await deps.exec('git', args);
        return {
          skill: await deps.readSkill(dir),
          dispose: () => deps.rm(dir),
        };
      } catch (error) {
        await deps.rm(dir).catch(() => {});
        throw error;
      }
    }
  }
}

/** 批量解析技能来源，聚合并返回统一 dispose。 */
export async function resolveSkills(
  refs: SkillRef[],
  deps: SkillSourceDeps = createDefaultSkillSourceDeps(),
): Promise<{ skills: Skill[]; dispose: () => Promise<void> }> {
  const resolved = await Promise.all(refs.map((ref) => resolveSkill(ref, deps)));
  return {
    skills: resolved.map((r) => r.skill),
    dispose: async () => {
      await Promise.all(resolved.map((r) => r.dispose()));
    },
  };
}
