#!/usr/bin/env node
/**
 * OpenSpec change 完整性校验（一个 change 对应一个 commit）。
 *
 * 规则：任何 active change（openspec/changes/ 下、非 archive）都视为失败——
 *   - 未完成：缺 proposal/tasks/design、缺 specs delta、tasks 有未勾选项；
 *   - 已完成但未归档：应先 `openspec archive` 归档（一个 change 一个 commit）。
 *
 * 用法：
 *   node scripts/check-openspec.mjs            # 校验全部 active change
 *   node scripts/check-openspec.mjs --staged   # 只校验本次提交涉及的 active change（接 pre-commit）
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGES_DIR = join(ROOT, 'openspec', 'changes');

const REQUIRED_FILES = ['proposal.md', 'tasks.md', 'design.md'];
const UNCHECKED_RE = /^\s*[-*]\s*\[[ ]\]/gm;

/** 列出全部 active change 目录名（排除 archive）。 */
function listActiveChangeDirs() {
  if (!existsSync(CHANGES_DIR)) return [];
  return readdirSync(CHANGES_DIR).filter((name) => {
    if (name === 'archive') return false;
    return statSync(join(CHANGES_DIR, name)).isDirectory();
  });
}

/** 从暂存区（新增/修改/重命名）反推本次提交涉及的 active change 名。 */
function stagedChangeDirs() {
  try {
    const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
      cwd: ROOT,
      encoding: 'utf-8',
    });
    const names = new Set();
    for (const line of out.split('\n')) {
      const m = line.match(/^openspec\/changes\/([^/]+)\//);
      if (m && m[1] !== 'archive') names.add(m[1]);
    }
    return [...names];
  } catch {
    return [];
  }
}

/** 校验单个 change，返回问题列表（空数组 = 通过）。 */
function checkChange(name) {
  const dir = join(CHANGES_DIR, name);
  const problems = [];

  for (const file of REQUIRED_FILES) {
    const path = join(dir, file);
    if (!existsSync(path)) {
      problems.push(`缺少 ${file}`);
    } else if (statSync(path).size === 0) {
      problems.push(`${file} 为空`);
    }
  }

  const specsDir = join(dir, 'specs');
  const hasSpecs =
    existsSync(specsDir) &&
    readdirSync(specsDir).some((sub) => {
      const subPath = join(specsDir, sub);
      return statSync(subPath).isDirectory() && readdirSync(subPath).some((f) => f.endsWith('.md'));
    });
  if (!hasSpecs) problems.push('缺少 specs/ delta spec（至少一份 *.md）');

  const tasksPath = join(dir, 'tasks.md');
  if (existsSync(tasksPath)) {
    const content = readFileSync(tasksPath, 'utf-8');
    const unchecked = content.match(UNCHECKED_RE) ?? [];
    if (unchecked.length > 0) {
      problems.push(`tasks.md 有 ${unchecked.length} 项未完成（- [ ]）`);
    }
  }

  // 文件齐全且 tasks 全勾选，但仍未归档 → 同样失败（一个 change 对应一个 commit）。
  if (problems.length === 0) {
    problems.push('已完成但未归档（请先 openspec archive 归档后再提交）');
  }

  return problems;
}

function main() {
  const stagedOnly = process.argv.includes('--staged');

  const changes = stagedOnly ? stagedChangeDirs() : listActiveChangeDirs();
  if (changes.length === 0) {
    console.log(
      stagedOnly
        ? 'OpenSpec：本次提交无 active change 改动，跳过。'
        : 'OpenSpec：无 active change。',
    );
    return 0;
  }

  const failures = [];
  for (const name of changes) {
    const problems = checkChange(name);
    if (problems.length > 0) failures.push({ name, problems });
  }

  if (failures.length > 0) {
    console.error('❌ OpenSpec 校验失败：');
    for (const { name, problems } of failures) {
      console.error(`  ${name}:`);
      for (const problem of problems) console.error(`    - ${problem}`);
    }
    console.error('\n一个 change 对应一个 commit：完成请先 archive，未完成请补全。');
    return 1;
  }

  console.log('✅ OpenSpec 校验通过（无未归档的 active change）。');
  return 0;
}

process.exit(main());
