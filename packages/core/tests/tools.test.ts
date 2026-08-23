import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';
import { ToolRegistry } from '../src/tools/registry';
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

  it('非法 JSON 被拒绝', async () => {
    const registry = new ToolRegistry();
    registry.register(makeWeatherTool());

    await expect(registry.execute('get_weather', 'not-json')).rejects.toThrow(/invalid JSON/);
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
});
