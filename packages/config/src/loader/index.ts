import { readFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { createJiti } from 'jiti';
import JSON5 from 'json5';
import { parse as parseYaml } from 'yaml';
import { AgentConfigSchema, type AgentConfig } from '../schema/index';
import { deepFreeze, sanitizeConfigValue } from './security';

/** `loadAgentConfig` 的可选参数。 */
export interface LoadAgentConfigOptions {
  /**
   * 是否允许加载 TypeScript 配置文件（默认 false）。
   * TS 配置会被当作代码执行（jiti），仅适用于受信任的本地开发输入。
   */
  allowTsConfig?: boolean;
  /** 配置文件大小上限（字节），默认 1 MiB。 */
  maxFileBytes?: number;
}

const DEFAULT_MAX_FILE_BYTES = 1024 * 1024;
const MAX_YAML_ALIASES = 100;
const TS_EXTENSIONS = new Set(['.ts', '.mts', '.cts']);

function createConfigError(path: string, message: string, cause?: unknown): Error {
  return new Error(`Failed to load agent config "${path}": ${message}`, { cause });
}

async function loadTypeScript(path: string): Promise<unknown> {
  const jiti = createJiti(import.meta.url);
  return jiti.import(path, { default: true });
}

/**
 * Load an agent config from a YAML / JSON(5) / TypeScript file and normalize
 * it into a validated {@link AgentConfig}.
 *
 * 安全默认：TypeScript 配置（会被当作代码执行）默认拒绝，仅 `allowTsConfig: true`
 * 时允许加载；解析前限制文件大小，解析后深度冻结产物使其不可变。
 */
export async function loadAgentConfig(
  path: string,
  options: LoadAgentConfigOptions = {},
): Promise<AgentConfig> {
  const ext = extname(path).toLowerCase();
  const { allowTsConfig = false, maxFileBytes = DEFAULT_MAX_FILE_BYTES } = options;

  if (TS_EXTENSIONS.has(ext) && !allowTsConfig) {
    throw createConfigError(
      path,
      'TypeScript config is disabled by default; pass { allowTsConfig: true } to load it',
    );
  }

  let data: unknown;
  try {
    const info = await stat(path);
    if (info.size > maxFileBytes) {
      throw new Error(`config file exceeds max size ${maxFileBytes} bytes (got ${info.size})`);
    }

    if (ext === '.yaml' || ext === '.yml') {
      const raw = await readFile(path, 'utf-8');
      data = parseYaml(raw, { maxAliasCount: MAX_YAML_ALIASES, uniqueKeys: true });
    } else if (ext === '.json' || ext === '.json5') {
      const raw = await readFile(path, 'utf-8');
      data = JSON5.parse(raw);
    } else if (TS_EXTENSIONS.has(ext)) {
      data = await loadTypeScript(path);
    } else {
      throw new Error(`unsupported config extension "${ext}"`);
    }
  } catch (error) {
    throw createConfigError(path, error instanceof Error ? error.message : String(error), error);
  }

  const result = AgentConfigSchema.safeParse(sanitizeConfigValue(data));
  if (!result.success) {
    throw createConfigError(path, result.error.message, result.error);
  }
  return deepFreeze(result.data);
}
