import { spawn } from 'node:child_process';
import type { SandboxExecRequest, SandboxExecResult } from './types';

export interface SandboxRunDefaults {
  timeoutMs?: number;
  maxOutputBytes?: number;
}

/**
 * 驱动系统二进制执行命令：spawn + 超时终止 + 输出截断 + 环境清洗。
 * 返回 exitCode / stdout / stderr / truncated；超时或启动失败抛错。
 */
export function runSandbox(
  bin: string,
  args: string[],
  req: SandboxExecRequest,
  defaults: SandboxRunDefaults,
): Promise<SandboxExecResult> {
  const timeoutMs = req.timeoutMs ?? defaults.timeoutMs ?? 30_000;
  const maxOutputBytes = req.maxOutputBytes ?? defaults.maxOutputBytes ?? 65_536;
  // 环境严格清洗：只透传调用方显式声明的 env + PATH，不继承宿主进程环境（密钥不入沙箱）。
  const env = { PATH: process.env.PATH ?? '', ...(req.env ?? {}) };

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let truncated = false;
    let settled = false;

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, timeoutMs);

    const append = (chunk: Buffer, stream: 'stdout' | 'stderr'): void => {
      if (stream === 'stdout') {
        stdout += chunk.toString();
        if (stdout.length > maxOutputBytes) {
          stdout = stdout.slice(0, maxOutputBytes);
          truncated = true;
        }
      } else {
        stderr += chunk.toString();
        if (stderr.length > maxOutputBytes) {
          stderr = stderr.slice(0, maxOutputBytes);
          truncated = true;
        }
      }
    };

    child.stdout?.on('data', (chunk: Buffer) => append(chunk, 'stdout'));
    child.stderr?.on('data', (chunk: Buffer) => append(chunk, 'stderr'));

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Failed to start "${bin}": ${error.message}`, { cause: error }));
    });

    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === null) {
        reject(
          new Error(
            `Command "${bin}" terminated (signal ${signal ?? 'unknown'}, timeout ${timeoutMs}ms)`,
          ),
        );
      } else {
        resolve({ exitCode: code, stdout, stderr, truncated });
      }
    });
  });
}
