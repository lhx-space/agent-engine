import { describe, expect, it } from '@rstest/core';
import wabt from 'wabt';
import { WasiFunctionSandbox } from '../src/sandbox/function';

/** 编译 WAT → wasm 字节（测试用，复用 wabt 官方二进制工具）。 */
async function compileWat(wat: string): Promise<Uint8Array> {
  const w = await wabt();
  const mod = w.parseWat('test.wat', wat);
  const { buffer } = mod.toBinary({ log: false });
  mod.destroy();
  return buffer;
}

/** 写 "hello from wasi\n" 到 stdout 后以给定 code 退出。 */
function helloWat(exitCode: number): string {
  return `(module
    (import "wasi_snapshot_preview1" "fd_write" (func $fd_write (param i32 i32 i32 i32) (result i32)))
    (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
    (memory (export "memory") 1)
    (data (i32.const 8) "hello from wasi\\n")
    (func $main (export "_start")
      (i32.store (i32.const 0) (i32.const 8))
      (i32.store (i32.const 4) (i32.const 16))
      (call $fd_write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 20))
      drop
      (call $proc_exit (i32.const ${exitCode}))
    )
  )`;
}

/** 死循环（测试超时终止）。node:wasi 要求导出 memory，故带上。 */
const infiniteWat = `(module
  (memory (export "memory") 1)
  (func $main (export "_start") (loop $l (br $l)))
)`;

describe('WasiFunctionSandbox', () => {
  const sandbox = new WasiFunctionSandbox();

  it('执行 WASI 模块：捕获 stdout + exitCode 0', async () => {
    const wasm = await compileWat(helloWat(0));
    const result = await sandbox.exec({ wasm });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello from wasi\n');
    expect(result.stderr).toBe('');
    expect(result.truncated).toBe(false);
  });

  it('透传非零 exitCode', async () => {
    const wasm = await compileWat(helloWat(42));
    const result = await sandbox.exec({ wasm });
    expect(result.exitCode).toBe(42);
  });

  it('输出超过 maxOutputBytes 被截断', async () => {
    const wasm = await compileWat(helloWat(0));
    const result = await sandbox.exec({ wasm, maxOutputBytes: 5 });
    expect(result.truncated).toBe(true);
    expect(result.stdout.length).toBeLessThanOrEqual(5);
  });

  it('超时终止：死循环模块抛错', async () => {
    const wasm = await compileWat(infiniteWat);
    await expect(sandbox.exec({ wasm, timeoutMs: 500 })).rejects.toThrow(/timeout|terminated/i);
  });
});
