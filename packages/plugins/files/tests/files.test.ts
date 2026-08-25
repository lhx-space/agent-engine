import { describe, expect, it } from '@rstest/core';
import type { FilePolicy } from '@agent-engine/config';
import { PluginManager } from '@agent-engine/core';
import { createFilesPlugin } from '../src/index';

function makeFilePolicy(): FilePolicy {
  return { roots: ['./'], maxFileBytes: 1_048_576 };
}

describe('createFilesPlugin', () => {
  it('注册 read_file / write_file / list_files', async () => {
    const manager = new PluginManager();
    await manager.install(createFilesPlugin(makeFilePolicy()));

    const names = manager.getAssembly().tools.map((tool) => tool.name);
    expect(names).toEqual(['builtin.read_file', 'builtin.write_file', 'builtin.list_files']);
  });
});
