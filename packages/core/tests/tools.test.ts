import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';
import { ToolRegistry, normalizeToolArgs, toLlmName } from '../src/tools/registry';
import type { Tool } from '../src/tools/types';

function makeWeatherTool(): Tool<{ city: string }, { temp: number }> {
  return {
    name: 'get_weather',
    description: 'Get weather for a city',
    inputSchema: z.object({ city: z.string() }),
    execute: async (input) => ({ temp: 20, city: input.city }),
  };
}

describe('ToolRegistry 注册与查询', () => {
  it('注册后可按名查询', () => {
    const registry = new ToolRegistry();
    const tool = makeWeatherTool();
    registry.register(tool);

    expect(registry.has('get_weather')).toBe(true);
    expect(registry.get('get_weather')).toBe(tool);
  });

  it('未注册工具查询返回空', () => {
    const registry = new ToolRegistry();
    expect(registry.has('unknown')).toBe(false);
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('同名注册后者覆盖', () => {
    const registry = new ToolRegistry();
    const v1 = makeWeatherTool();
    const v2 = { ...makeWeatherTool(), description: 'v2' };
    registry.register(v1);
    registry.register(v2);

    expect(registry.get('get_weather')).toBe(v2);
    expect(registry.list()).toHaveLength(1);
  });

  it('注销已注册工具', () => {
    const registry = new ToolRegistry();
    registry.register(makeWeatherTool());

    expect(registry.unregister('get_weather')).toBe(true);
    expect(registry.has('get_weather')).toBe(false);
    expect(registry.unregister('get_weather')).toBe(false);
  });
});

describe('ToolRegistry 执行', () => {
  it('合法参数执行成功', async () => {
    const registry = new ToolRegistry();
    registry.register(makeWeatherTool());

    const result = await registry.execute('get_weather', '{"city":"beijing"}');
    expect(result).toEqual({ temp: 20, city: 'beijing' });
  });

  it('非法参数被 Zod 校验拒绝', async () => {
    const registry = new ToolRegistry();
    registry.register(makeWeatherTool());

    await expect(registry.execute('get_weather', '{"city":123}')).rejects.toThrow(/get_weather/);
  });

  it('非法 JSON 兜底为 {} 后走 inputSchema 校验', async () => {
    const registry = new ToolRegistry();
    registry.register(makeWeatherTool());

    // 非法 JSON 不再抛 invalid JSON，而是兜底 {}，交由 inputSchema 校验报缺字段。
    await expect(registry.execute('get_weather', 'not-json')).rejects.toThrow(/get_weather/);
  });

  it('未注册工具报错', async () => {
    const registry = new ToolRegistry();
    await expect(registry.execute('unknown', '{}')).rejects.toThrow(/not registered/);
  });

  it('校验失败错误信息含工具名', async () => {
    const registry = new ToolRegistry();
    registry.register(makeWeatherTool());

    await expect(registry.execute('get_weather', '{}')).rejects.toThrow(
      /get_weather.*invalid arguments/,
    );
  });
});

describe('Zod → JSON Schema 转换', () => {
  it('工具转换为 ToolDefinition', () => {
    const registry = new ToolRegistry();
    registry.register(makeWeatherTool());

    const defs = registry.toToolDefinitions();
    expect(defs).toHaveLength(1);

    const def = defs[0];
    expect(def?.type).toBe('function');
    expect(def?.function.name).toBe('get_weather');
    expect(def?.function.description).toBe('Get weather for a city');
    expect(def?.function.parameters).toMatchObject({ type: 'object' });
  });

  it('jsonSchema 优先透传（MCP 工具）', () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'mcp_tool',
      description: 'mcp tool',
      inputSchema: z.unknown(),
      jsonSchema: { type: 'object', properties: { x: { type: 'string' } } },
      execute: async () => 'ok',
    });

    const def = registry.toToolDefinitions()[0];
    expect(def?.function.parameters).toEqual({
      type: 'object',
      properties: { x: { type: 'string' } },
    });
  });

  it('function.name 满足 LLM 约束（点号转下划线）', () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'builtin.read_file',
      description: 'read file',
      inputSchema: z.object({ path: z.string() }),
      execute: async () => 'ok',
    });

    const def = registry.toToolDefinitions()[0];
    expect(def?.function.name).toBe('builtin_read_file');
    expect(def?.function.name).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  it('LLM 回调名反查真实语义名', () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'builtin.read_file',
      description: 'read file',
      inputSchema: z.object({ path: z.string() }),
      execute: async () => 'ok',
    });

    expect(registry.resolveName('builtin_read_file')).toBe('builtin.read_file');
  });

  it('toLlmName 将非法字符统一替换为下划线', () => {
    expect(toLlmName('builtin.read_file')).toBe('builtin_read_file');
    expect(toLlmName('a.b-c')).toBe('a_b-c');
    expect(toLlmName('ok_name-1')).toBe('ok_name-1');
  });
});

describe('工具入参规范化', () => {
  it('空/空白入参兜底为 {}', () => {
    expect(normalizeToolArgs('')).toBe('{}');
    expect(normalizeToolArgs('   ')).toBe('{}');
  });

  it('非法 JSON 兜底为 {}', () => {
    expect(normalizeToolArgs('not-json')).toBe('{}');
    expect(normalizeToolArgs('{"path":')).toBe('{}');
  });

  it('合法 JSON 原样返回', () => {
    expect(normalizeToolArgs('{"path":"a"}')).toBe('{"path":"a"}');
  });

  it('execute 空入参不再抛 invalid JSON，而是走 inputSchema 校验', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'need_path',
      description: 'd',
      inputSchema: z.object({ path: z.string() }),
      execute: async () => 'ok',
    });

    await expect(registry.execute('need_path', '')).rejects.toThrow(/path/);
  });
});
