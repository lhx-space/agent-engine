import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * FunctionSandbox：隔离执行「编译成 wasm 的可信度未知的用户代码/工具函数」（WASI）。
 * 与 `SandboxBackend`（bash/kubectl 原生命令，docker/nsjail）正交——WASI 沙箱的是 wasm 代码，
 * 不能沙箱原生命令；二者分工见 AGENTS.md 5.6。
 */

/** WASI 执行请求：编译好的 wasm 字节 + 参数 / 标准输入 / 环境 / 资源限制。 */
export interface FunctionSandboxExecRequest {
  wasm: Uint8Array;
  args?: string[];
  stdin?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export interface FunctionSandboxExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  /** 输出是否因超过 maxOutputBytes 被截断。 */
  truncated: boolean;
}

/** 函数沙箱后端接口：聚焦「隔离执行 wasm/WASI 代码」。 */
export interface FunctionSandbox {
  readonly kind: string;
  exec(req: FunctionSandboxExecRequest): Promise<FunctionSandboxExecResult>;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_OUTPUT_BYTES = 65_536;

/**
 * 子进程内运行 WASI 模块的 runner（ESM，经 `node --input-type=module -e` 执行）。
 * 独立子进程隔离 + 超时可杀 + stdout/stderr 管道捕获（WASI 的 fd 0/1 映射到子进程 stdio）。
 */
const RUNNER = `
import { readFile } from 'node:fs/promises';
import { WASI } from 'node:wasi';
const wasmPath = process.env.FN_WASM_PATH;
const args = JSON.parse(process.env.FN_ARGS ?? '[]');
const env = JSON.parse(process.env.FN_ENV ?? '{}');
const wasm = await readFile(wasmPath);
const wasi = new WASI({ args: [wasmPath, ...args], env, version: 'preview1' });
const mod = await WebAssembly.compile(wasm);
const inst = await WebAssembly.instantiate(mod, { wasi_snapshot_preview1: wasi.wasiImport });
try {
  const code = wasi.start(inst);
  process.exit(typeof code === 'number' ? code : 0);
} catch (e) {
  process.exit(typeof e?.exitCode === 'number' ? e.exitCode : 1);
}
`;

/**
 * 驱动 `node:wasi` 执行 wasm：写临时文件 → spawn 子进程 → 超时终止 + 输出截断 + 环境清洗。
 * 返回 exitCode / stdout / stderr / truncated；超时或启动失败抛错。
 */
function runWasi(
  env: Record<string, string>,
  options: { stdin?: string; timeoutMs: number; maxOutputBytes: number },
): Promise<FunctionSandboxExecResult> {
  const child = spawn(process.execPath, ['--no-warnings', '--input-type=module', '-e', RUNNER], {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let truncated = false;
    let settled = false;

    const timer = setTimeout(() => child.kill('SIGKILL'), options.timeoutMs);

    const append = (chunk: Buffer, stream: 'stdout' | 'stderr'): void => {
      if (stream === 'stdout') {
        stdout += chunk.toString();
        if (stdout.length > options.maxOutputBytes) {
          stdout = stdout.slice(0, options.maxOutputBytes);
          truncated = true;
        }
      } else {
        stderr += chunk.toString();
        if (stderr.length > options.maxOutputBytes) {
          stderr = stderr.slice(0, options.maxOutputBytes);
          truncated = true;
        }
      }
    };

    child.stdout?.on('data', (chunk: Buffer) => append(chunk, 'stdout'));
    child.stderr?.on('data', (chunk: Buffer) => append(chunk, 'stderr'));

    if (options.stdin !== undefined) {
      child.stdin?.write(options.stdin);
    }
    child.stdin?.end();

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Failed to start wasm runner: ${error.message}`, { cause: error }));
    });

    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === null) {
        reject(
          new Error(
            `WASI module terminated (signal ${signal ?? 'unknown'}, timeout ${options.timeoutMs}ms)`,
          ),
        );
      } else {
        resolve({ exitCode: code, stdout, stderr, truncated });
      }
    });
  });
}

/** 开发默认：`node:wasi` 实现（零 Docker 依赖，复用 Node 内置 WASI 运行时）。 */
export class WasiFunctionSandbox implements FunctionSandbox {
  readonly kind = 'wasi';

  async exec(req: FunctionSandboxExecRequest): Promise<FunctionSandboxExecResult> {
    const dir = await mkdtemp(join(tmpdir(), 'fn-sandbox-'));
    const wasmPath = join(dir, 'module.wasm');
    await writeFile(wasmPath, req.wasm);

    const env = {
      FN_WASM_PATH: wasmPath,
      FN_ARGS: JSON.stringify(req.args ?? []),
      FN_ENV: JSON.stringify(req.env ?? {}),
    };

    try {
      return await runWasi(env, {
        stdin: req.stdin,
        timeoutMs: req.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxOutputBytes: req.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
