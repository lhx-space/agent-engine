import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadAgentConfig } from './loader/index.js';

const dirs: string[] = [];

async function tmpDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'agent-config-'));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

const baseConfig = {
  name: 'devops-agent',
  model: { model: 'deepseek-chat' },
  systemPrompt: { template: 'you are {{role}}', variables: { role: 'devops' } },
  rules: [{ id: 'r1', kind: 'guardrail', on: 'beforeToolCall' }],
};

describe('loadAgentConfig', () => {
  it('YAML / JSON5 / TypeScript 三格式产出等价 AgentConfig', async () => {
    const dir = await tmpDir();

    const yamlPath = join(dir, 'a.yaml');
    await writeFile(
      yamlPath,
      [
        'name: devops-agent',
        'model:',
        '  model: deepseek-chat',
        'systemPrompt:',
        '  template: "you are {{role}}"',
        '  variables:',
        '    role: devops',
        'rules:',
        '  - id: r1',
        '    kind: guardrail',
        '    on: beforeToolCall',
      ].join('\n'),
    );

    const jsonPath = join(dir, 'b.json5');
    await writeFile(jsonPath, JSON.stringify(baseConfig, null, 2));

    const tsPath = join(dir, 'c.ts');
    await writeFile(tsPath, `export default ${JSON.stringify(baseConfig, null, 2)};\n`);

    const [fromYaml, fromJson, fromTs] = await Promise.all([
      loadAgentConfig(yamlPath),
      loadAgentConfig(jsonPath),
      loadAgentConfig(tsPath),
    ]);

    expect(fromJson).toEqual(fromYaml);
    expect(fromTs).toEqual(fromYaml);
    expect(fromYaml.rules[0]).toMatchObject({ kind: 'guardrail', on: 'beforeToolCall' });
  });

  it('非法配置抛含路径的错误', async () => {
    const dir = await tmpDir();
    const path = join(dir, 'bad.yaml');
    await writeFile(path, 'name: x\nmodel: {}\nsystemPrompt: {}\n');

    await expect(loadAgentConfig(path)).rejects.toThrow(/bad\.yaml/);
  });

  it('不支持的扩展名抛错', async () => {
    const dir = await tmpDir();
    const path = join(dir, 'x.toml');
    await writeFile(path, 'a = 1\n');

    await expect(loadAgentConfig(path)).rejects.toThrow(/unsupported config extension/);
  });
});
