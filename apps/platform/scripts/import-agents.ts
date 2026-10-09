import { resolve } from 'node:path';
import { closeDb } from '../src/db/client';
import { importHarnessRoot } from '../src/lib/import-dir';

/**
 * 目录化迁移 CLI：把 `.lhx-agent/*` 导入为市场商品 + agent 实例。
 *
 * 用法：
 *   PLATFORM_DATABASE_URL=... pnpm --filter @lhx-agent-engine/platform import:agents [harnessRoot]
 * 默认 harnessRoot 为仓库根的 agents/.lhx-agent。
 */
async function main(): Promise<void> {
  const root = resolve(process.argv[2] ?? 'agents/.lhx-agent');
  const results = await importHarnessRoot(root);
  for (const result of results) {
    console.log(`✓ 导入 agent=${result.agentId} item=${result.itemId}`);
    for (const note of result.unsupported) {
      console.log(`  · 不支持项：${note}`);
    }
  }
  if (results.length === 0) console.log('未发现可导入的 agent 目录');
  await closeDb();
}

void main();
