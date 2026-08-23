import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * 将路径约束在允许根目录内：resolve 后经 realpath 解析（防 symlink 逃逸），
 * 越界（根外 / `..` / symlink 指向根外）抛错。目标不存在时退化为 realpath 父目录 + basename。
 */
export async function resolveWithinRoot(roots: string[], filePath: string): Promise<string> {
  if (roots.length === 0) {
    throw new Error('No allowed file roots configured');
  }
  const abs = path.resolve(filePath);
  // roots 也走 realpath，避免 macOS 上 /var → /private/var 等符号链接导致两侧路径空间不一致。
  const resolvedRoots: string[] = [];
  for (const root of roots) {
    const resolved = path.resolve(root);
    try {
      resolvedRoots.push(await fs.realpath(resolved));
    } catch {
      resolvedRoots.push(resolved);
    }
  }

  let real: string;
  try {
    real = await fs.realpath(abs);
  } catch {
    const parent = path.dirname(abs);
    const base = path.basename(abs);
    let realParent: string;
    try {
      realParent = await fs.realpath(parent);
    } catch {
      realParent = parent;
    }
    real = path.join(realParent, base);
  }

  for (const root of resolvedRoots) {
    const rel = path.relative(root, real);
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
      return real;
    }
  }
  throw new Error(`Path "${filePath}" is outside allowed roots`);
}
