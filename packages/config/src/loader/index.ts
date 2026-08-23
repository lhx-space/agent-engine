import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { createJiti } from 'jiti';
import JSON5 from 'json5';
import { parse as parseYaml } from 'yaml';
import { AgentConfigSchema, type AgentConfig } from '../schema/index';

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
 */
export async function loadAgentConfig(path: string): Promise<AgentConfig> {
  const ext = extname(path).toLowerCase();

  let data: unknown;
  try {
    if (ext === '.yaml' || ext === '.yml') {
      const raw = await readFile(path, 'utf-8');
      data = parseYaml(raw);
    } else if (ext === '.json' || ext === '.json5') {
      const raw = await readFile(path, 'utf-8');
      data = JSON5.parse(raw);
    } else if (ext === '.ts' || ext === '.mts' || ext === '.cts') {
      data = await loadTypeScript(path);
    } else {
      throw new Error(`unsupported config extension "${ext}"`);
    }
  } catch (error) {
    throw createConfigError(path, error instanceof Error ? error.message : String(error), error);
  }

  const result = AgentConfigSchema.safeParse(data);
  if (!result.success) {
    throw createConfigError(path, result.error.message, result.error);
  }
  return result.data;
}
