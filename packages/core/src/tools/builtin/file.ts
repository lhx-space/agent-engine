import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { FilePolicy } from '@agent-engine/config';
import type { Tool } from '../types';
import { resolveWithinRoot } from '../utils/path';

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

// ============ schema ============

const ReadFileInputSchema = z.object({ path: z.string().min(1) });
const WriteFileInputSchema = z.object({ path: z.string().min(1), content: z.string() });

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
      const max = policy.maxFileBytes;
      if (buffer.length > max) {
        return {
          path: real,
          content: `${buffer.subarray(0, max).toString('utf8')}\n... (truncated)`,
          truncated: true,
        };
      }
      return { path: real, content: buffer.toString('utf8'), truncated: false };
    },
  };
}

export function createWriteFileTool(policy: FilePolicy): Tool<WriteFileInput, WriteFileResult> {
  return {
    name: 'builtin.write_file',
    description:
      'Write a text file within the workspace. Only paths within allowed roots are writable.',
    inputSchema: WriteFileInputSchema,
    execute: async ({ path: filePath, content }) => {
      const bytes = Buffer.byteLength(content, 'utf8');
      if (bytes > policy.maxFileBytes) {
        throw new Error(`Content exceeds maxFileBytes (${policy.maxFileBytes})`);
      }
      const real = await resolveWithinRoot(policy.roots, filePath);
      await fs.mkdir(path.dirname(real), { recursive: true });
      await fs.writeFile(real, content, 'utf8');
      return { path: real, bytes };
    },
  };
}
