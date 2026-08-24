import { describe, expect, it } from '@rstest/core';
import { deepFreeze, sanitizeConfigValue } from '../src/loader/security';

describe('sanitizeConfigValue', () => {
  it('递归剔除危险 key（JSON 解析出真实 __proto__ 自有属性）', () => {
    const input = JSON.parse(
      '{"safe":1,"__proto__":{"polluted":true},"constructor":"x","nested":{"prototype":"y","ok":true},"arr":[{"__proto__":{"p":1},"v":2}]}',
    ) as Record<string, unknown>;

    const out = sanitizeConfigValue(input) as Record<string, unknown>;
    expect(Object.keys(out).sort()).toEqual(['arr', 'nested', 'safe']);
    expect(out.nested).toEqual({ ok: true });
    expect(out.arr).toEqual([{ v: 2 }]);
  });

  it('不修改入参且原始值原样返回', () => {
    const input = JSON.parse('{"a":1,"__proto__":{"x":1}}') as Record<string, unknown>;
    const out = sanitizeConfigValue(input);

    expect(input.a).toBe(1);
    expect(Object.prototype.hasOwnProperty.call(input, '__proto__')).toBe(true);
    expect(out).toEqual({ a: 1 });
    expect(sanitizeConfigValue(42)).toBe(42);
    expect(sanitizeConfigValue('s')).toBe('s');
  });
});

describe('deepFreeze', () => {
  it('深度冻结嵌套对象与数组', () => {
    const obj = { a: { b: [1, 2] } };
    const frozen = deepFreeze(obj);

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.a)).toBe(true);
    expect(Object.isFrozen(frozen.a.b)).toBe(true);
    expect(() => {
      frozen.a.b.push(3);
    }).toThrow(TypeError);
  });

  it('跳过非 plain 值', () => {
    const date = new Date();
    const obj = { d: date };
    deepFreeze(obj);

    expect(Object.isFrozen(obj)).toBe(true);
    expect(Object.isFrozen(date)).toBe(false);
  });

  it('处理环引用不爆栈', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    deepFreeze(obj);

    expect(Object.isFrozen(obj)).toBe(true);
  });
});
