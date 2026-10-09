import { AgentConfigSchema, deepFreeze, sanitizeConfigValue } from '@lhx-agent-engine/config';
import type { AgentConfig } from '@lhx-agent-engine/config';

export type ParseManifestResult =
  { ok: true; config: AgentConfig } | { ok: false; issues: string[] };

/**
 * manifest（jsonb）→ `AgentConfig`：写入与读取都走同一份 Zod Schema（单一事实来源）。
 *
 * 安全防线（从 apps/server 搬来，平台必须保留）：先 `sanitizeConfigValue` 剔除危险键
 * （原型污染等）→ 再 Zod 校验 → 最后 `deepFreeze` 冻结，避免运行期被篡改。
 * 校验失败不抛错，返回 issues 供上层决定「拒绝写入」或「只读降级」。
 */
export function parseManifest(value: unknown): ParseManifestResult {
  const result = AgentConfigSchema.safeParse(sanitizeConfigValue(value));
  if (result.success) return { ok: true, config: deepFreeze(result.data) };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    }),
  };
}

/** `AgentConfig` → manifest（jsonb）。 */
export function serializeManifest(config: AgentConfig): Record<string, unknown> {
  return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
}

/**
 * 规范化 JSON（键按字典序）：pg 的 jsonb **不保留键顺序**，
 * 故往返校验不能直接用 `JSON.stringify` 比较，必须走规范化后再比。
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, current: unknown) => {
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(current as Record<string, unknown>).sort()) {
        sorted[key] = (current as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return current;
  });
}

/** 版本 manifest 合并租户覆写：浅合并 + 顶层对象深一层的合并（够用且不发明复杂语义）。 */
export function mergeManifest(
  manifest: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...manifest };
  for (const [key, value] of Object.entries(overrides)) {
    const base = merged[key];
    if (
      base &&
      typeof base === 'object' &&
      !Array.isArray(base) &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      merged[key] = { ...(base as Record<string, unknown>), ...(value as Record<string, unknown>) };
    } else {
      merged[key] = value;
    }
  }
  return merged;
}
