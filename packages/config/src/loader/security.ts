/**
 * 配置加载安全原语：入口 sanitize（防原型污染）+ 出口 deepFreeze（防篡改）。
 */

/** 需从配置对象中剔除的危险 key（原型污染向量）。 */
export const DANGEROUS_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * 深递归剔除危险 key，返回净化后的新值（不修改入参）。
 * 仅处理纯对象与数组；原始值原样返回。
 */
export function sanitizeConfigValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeConfigValue(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      if (DANGEROUS_KEYS.has(key)) continue;
      out[key] = sanitizeConfigValue(source[key]);
    }
    return out as T;
  }
  return value;
}

/**
 * 深度冻结对象与数组（`Object.freeze` 递归），使配置不可变。
 * 仅冻结纯对象 / 数组 / 空原型对象，跳过 Date / RegExp / Map / 类实例等非 plain 值；
 * 用 WeakSet 防环与共享引用导致的无限递归。
 */
export function deepFreeze<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);

  const proto = Object.getPrototypeOf(value);
  const isPlain = Array.isArray(value) || proto === Object.prototype || proto === null;
  if (isPlain) {
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key], seen);
    }
    Object.freeze(value);
  }
  return value;
}
