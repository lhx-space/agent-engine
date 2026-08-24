import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from '@rstest/core';
import { loadAgentConfig } from '../src/loader/index';

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
  rules: [{ id: 'r1', kind: 'on-demand', description: '规则说明', content: '规则内容' }],
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
        '    kind: on-demand',
        '    description: 规则说明',
        '    content: 规则内容',
      ].join('\n'),
    );

    const jsonPath = join(dir, 'b.json5');
    await writeFile(jsonPath, JSON.stringify(baseConfig, null, 2));

    const tsPath = join(dir, 'c.ts');
    await writeFile(tsPath, `export default ${JSON.stringify(baseConfig, null, 2)};\n`);

    const [fromYaml, fromJson, fromTs] = await Promise.all([
      loadAgentConfig(yamlPath),
      loadAgentConfig(jsonPath),
      loadAgentConfig(tsPath, { allowTsConfig: true }),
    ]);

    expect(fromJson).toEqual(fromYaml);
    expect(fromTs).toEqual(fromYaml);
    expect(fromYaml.rules[0]).toMatchObject({ kind: 'on-demand', content: '规则内容' });
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

  it('TypeScript 配置默认拒绝', async () => {
    const dir = await tmpDir();
    const path = join(dir, 'c.ts');
    await writeFile(path, `export default ${JSON.stringify(baseConfig)};\n`);

    await expect(loadAgentConfig(path)).rejects.toThrow(/TypeScript config is disabled/);
  });

  it('超过大小上限的文件抛错', async () => {
    const dir = await tmpDir();
    const path = join(dir, 'big.yaml');
    await writeFile(
      path,
      'name: devops-agent\nmodel: { model: m }\nsystemPrompt: { template: t }\n',
    );

    await expect(loadAgentConfig(path, { maxFileBytes: 10 })).rejects.toThrow(/exceeds max size/);
  });

  it('YAML 别名炸弹抛错', async () => {
    const dir = await tmpDir();
    const path = join(dir, 'bomb.yaml');
    await writeFile(
      path,
      [
        'a: &a [x,x,x,x,x,x,x,x,x,x,x,x,x,x,x,x]',
        'b: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a,*a,*a,*a,*a,*a,*a,*a]',
        'c: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b,*b,*b,*b,*b,*b,*b,*b]',
        'd: &d [*c,*c,*c,*c,*c,*c,*c,*c,*c,*c,*c,*c,*c,*c,*c,*c]',
      ].join('\n'),
    );

    await expect(loadAgentConfig(path)).rejects.toThrow(/Excessive alias count/);
  });

  it('校验后产物深度冻结（不可变）', async () => {
    const dir = await tmpDir();
    const path = join(dir, 'a.yaml');
    await writeFile(path, 'name: x\nmodel: { model: m }\nsystemPrompt: { template: t }\n');

    const config = await loadAgentConfig(path);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.model)).toBe(true);
    expect(() => {
      config.model.model = 'hacked';
    }).toThrow(TypeError);
  });

  it('危险 key 被剔除且原型未污染', async () => {
    const dir = await tmpDir();
    const path = join(dir, 'pollute.yaml');
    await writeFile(
      path,
      [
        'name: x',
        'model: { model: m }',
        'systemPrompt:',
        '  template: t',
        '  variables:',
        '    __proto__:',
        '      polluted: true',
        '    constructor: x',
        '    safe: 1',
      ].join('\n'),
    );

    const config = await loadAgentConfig(path);
    const vars = config.systemPrompt.variables as Record<string, unknown>;
    expect(vars).toMatchObject({ safe: 1 });
    expect(Object.prototype.hasOwnProperty.call(vars, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(vars, 'constructor')).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
