import { promises as fs } from 'node:fs';
import path from 'node:path';
import picomatch from 'picomatch';
import { z } from 'zod';
import type { FilePolicy } from '@lhx-agent-engine/config';
import type { Tool } from './types';
import { resolveWithinRoot } from './utils/path';

// ============ 类型 ============

/** read_file 入参。 */
export interface ReadFileInput {
  path: string;
}

/** read_file 结果。 */
export interface ReadFileResult {
  path: string;
  content: string;
  truncated: boolean;
}

/** write_file 入参。 */
export interface WriteFileInput {
  path: string;
  content: string;
}

/** write_file 结果。 */
export interface WriteFileResult {
  path: string;
  bytes: number;
}

/** 文件/目录条目。 */
export interface FileEntry {
  /** 相对 workspace root 的 posix 路径。 */
  path: string;
  type: 'file' | 'dir';
  /** 文件字节数（仅 file 有值）。 */
  size?: number;
}

/** list_files 入参。 */
export interface ListFilesInput {
  /** 要列举的目录；缺省 = 第一个允许 root。 */
  path?: string;
  /** 可选 glob（picomatch 语法），相对 workspace 匹配。 */
  glob?: string;
  /** 递归深度（0 = 仅直接子项）。 */
  maxDepth?: number;
  /** 返回条目上限。 */
  maxEntries?: number;
}

/** list_files 结果。 */
export interface ListFilesResult {
  root: string;
  entries: FileEntry[];
  /** 是否因达到 maxEntries 上限而截断。 */
  truncated: boolean;
}

// ============ schema ============

const ReadFileInputSchema = z.object({ path: z.string().min(1) });
const WriteFileInputSchema = z.object({ path: z.string().min(1), content: z.string() });
const ListFilesInputSchema = z.object({
  path: z.string().optional(),
  glob: z.string().optional(),
  maxDepth: z.number().int().min(0).max(8).default(1),
  maxEntries: z.number().int().min(1).max(1000).default(200),
});

// ============ 支撑 ============

/**
 * 在不超过 `maxBytes` 字节的前提下，把 buffer 截断到安全 UTF-8 字符边界：
 * 若边界落在多字节字符中间（后续字节为 10xxxxxx 连续字节），向前回退（最多 3 字节，
 * UTF-8 单字符最长 4 字节）直到命中字符起始，避免输出 �。
 */
function decodeUtf8Truncated(
  buffer: Buffer,
  maxBytes: number,
): { content: string; truncated: boolean } {
  if (buffer.length <= maxBytes) return { content: buffer.toString('utf8'), truncated: false };
  let end = maxBytes;
  while (end > 0 && end > maxBytes - 4 && ((buffer[end] ?? 0) & 0xc0) === 0x80) {
    end -= 1;
  }
  return {
    content: `${buffer.subarray(0, end).toString('utf8')}\n... (truncated)`,
    truncated: true,
  };
}

/** 统一用 `/` 分隔（glob 匹配与跨平台一致）。 */
function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/**
 * 递归列举目录：目录优先 + 按名稳定排序，跳过隐藏项与 `node_modules`；
 * 仅返回匹配 glob 的条目，`entries` 达上限即停止并置 `truncated`。
 */
async function listDirectory(
  root: string,
  maxDepth: number,
  maxEntries: number,
  isMatch: (rel: string) => boolean,
): Promise<ListFilesResult> {
  const entries: FileEntry[] = [];
  let truncated = false;

  const walk = async (current: string, depth: number): Promise<void> => {
    if (truncated) return;
    const children = await fs.readdir(current, { withFileTypes: true });
    children.sort((a, b) => {
      const aDir = a.isDirectory();
      const bDir = b.isDirectory();
      if (aDir !== bDir) return aDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const child of children) {
      if (truncated) return;
      if (child.name.startsWith('.') || child.name === 'node_modules') continue;

      const abs = path.join(current, child.name);
      const rel = toPosix(path.relative(root, abs));
      const isDir = child.isDirectory();

      if (isMatch(rel)) {
        if (entries.length >= maxEntries) {
          truncated = true;
          return;
        }
        const entry: FileEntry = { path: rel, type: isDir ? 'dir' : 'file' };
        if (!isDir) entry.size = (await fs.stat(abs)).size;
        entries.push(entry);
      }

      if (isDir && depth < maxDepth) {
        await walk(abs, depth + 1);
      }
    }
  };

  await walk(root, 0);
  return { root, entries, truncated };
}

// ============ 工具 ============

export function createReadFileTool(policy: FilePolicy): Tool<ReadFileInput, ReadFileResult> {
  return {
    name: 'builtin.read_file',
    description:
      'Read a text file from the workspace. Only files within allowed roots are accessible.',
    inputSchema: ReadFileInputSchema,
    execute: async ({ path: filePath }) => {
      const real = await resolveWithinRoot(policy.roots, filePath);
      const buffer = await fs.readFile(real);
      const decoded = decodeUtf8Truncated(buffer, policy.maxFileBytes);
      return { path: real, content: decoded.content, truncated: decoded.truncated };
    },
  };
}

export function createWriteFileTool(policy: FilePolicy): Tool<WriteFileInput, WriteFileResult> {
  return {
    name: 'builtin.write_file',
    description:
      'Write a text file. Relative paths are resolved under the agent work directory; absolute paths must be within allowed roots.',
    inputSchema: WriteFileInputSchema,
    execute: async ({ path: filePath, content }) => {
      const bytes = Buffer.byteLength(content, 'utf8');
      if (bytes > policy.maxFileBytes) {
        throw new Error(`Content exceeds maxFileBytes (${policy.maxFileBytes})`);
      }
      // 相对路径写进 workDir（per-agent 工作目录）；绝对路径写进 roots（workspace）。
      const writeRoot = policy.workDir ?? policy.roots[0];
      if (!writeRoot) throw new Error('No allowed file roots configured');
      const roots = path.isAbsolute(filePath) ? policy.roots : [writeRoot];
      const real = await resolveWithinRoot(roots, filePath);
      await fs.mkdir(path.dirname(real), { recursive: true });
      await fs.writeFile(real, content, 'utf8');
      return { path: real, bytes };
    },
  };
}

export function createListFilesTool(policy: FilePolicy): Tool<ListFilesInput, ListFilesResult> {
  return {
    name: 'builtin.list_files',
    description:
      'List files and directories within the workspace (sorted, dirs first). Supports glob filtering and depth/entry limits; hidden entries and node_modules are skipped.',
    inputSchema: ListFilesInputSchema,
    execute: async (input) => {
      const rootRaw = policy.roots[0];
      if (!rootRaw) throw new Error('No allowed file roots configured');

      const base = input.path
        ? await resolveWithinRoot(policy.roots, input.path)
        : await resolveWithinRoot(policy.roots, rootRaw);

      const stat = await fs.stat(base);
      if (!stat.isDirectory()) throw new Error(`Not a directory: "${base}"`);

      let matcher: ((rel: string) => boolean) | undefined;
      if (input.glob) {
        matcher = picomatch(input.glob, { dot: false }) || undefined;
        if (!matcher) throw new Error(`Invalid glob pattern: "${input.glob}"`);
      }
      const isMatch = (rel: string): boolean => (matcher ? matcher(rel) : true);

      return listDirectory(base, input.maxDepth ?? 1, input.maxEntries ?? 200, isMatch);
    },
  };
}
