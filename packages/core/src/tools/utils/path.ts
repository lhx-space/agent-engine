import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * 对可能不存在的路径做 realpath：向上找到最近存在的祖先并 realpath，再拼接剩余相对段。
 * 避免 macOS `/var → /private/var` 等符号链接导致两侧路径空间不一致（含多级未建目录场景）。
 */
async function realpathAllowMissing(p: string): Promise<string> {
  try {
    return await fs.realpath(p);
  } catch {
    const parent = path.dirname(p);
    if (parent === p) return p; // 已到根（不存在），原样返回
    return path.join(await realpathAllowMissing(parent), path.basename(p));
  }
}

/**
 * 将路径约束在允许根目录内：resolve 后经 realpath 解析（防 symlink 逃逸），
 * 越界（根外 / `..` / symlink 指向根外）抛错。相对路径锚定第一个允许根，而非进程 cwd。
 */
export async function resolveWithinRoot(roots: string[], filePath: string): Promise<string> {
  const first = roots[0];
  if (!first) {
    throw new Error('No allowed file roots configured');
  }
  const abs = path.resolve(first, filePath);
  const real = await realpathAllowMissing(abs);

  for (const root of roots) {
    const resolvedRoot = await realpathAllowMissing(path.resolve(root));
    const rel = path.relative(resolvedRoot, real);
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
      return real;
    }
  }
  throw new Error(`Path "${filePath}" is outside allowed roots`);
}
