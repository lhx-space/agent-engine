// NAPI native 模块自测入口：`pnpm run start`
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalize, countTokens, sha256Hex } = require('./index.js');

let failed = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  console.log(
    `${ok ? '✓' : '✗'} ${name}: ${JSON.stringify(actual)}${ok ? '' : `（期望 ${JSON.stringify(expected)}）`}`,
  );
  if (!ok) failed += 1;
}

console.log('=== @lhx-agent-engine/native 自测 ===\n');

// 1. normalize（归一化）
check(
  'normalize trim+lowercase',
  normalize('  Hello  World  ', { trim: true, lowercase: true }),
  'hello  world',
);
check('normalize 无 options', normalize('Hello World'), 'Hello World');

// 2. count_tokens（分词 + 标点计数）
check('count_tokens("hello world")', countTokens('hello world'), 2);
check('count_tokens("")', countTokens(''), 0);

// 3. sha256_hex（标准测试向量）
check(
  'sha256_hex("abc")',
  sha256Hex('abc'),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
);
check(
  'sha256_hex("")',
  sha256Hex(''),
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
);

console.log(`\n${failed === 0 ? '✅ 全部通过' : `❌ ${failed} 项失败`}`);
process.exit(failed === 0 ? 0 : 1);
