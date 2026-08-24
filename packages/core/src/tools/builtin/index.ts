import type { SandboxBackendKind, SecurityConfig } from '@agent-engine/config';
import { resolveSandboxBackend } from '../../sandbox';
import type { SandboxResolution } from '../../sandbox';
import type { SandboxBackend, SandboxBackendOptions } from '../../sandbox/types';
import type { ToolRegistry } from '../registry';
import type { FetchLike } from '../utils/http';
import type { SearchProvider } from '../utils/search';
import { createDuckDuckGoSearchProvider } from '../utils/duckduckgo';
import { TodoStore } from '../utils/todo-store';
import { createBase64Tool } from './base64';
import { createBashTool } from './bash';
import { createCalculatorTool } from './calculator';
import { createDatetimeTool } from './datetime';
import { createReadFileTool, createWriteFileTool } from './file';
import { createJsonTool } from './json';
import { createSiteSearchTool } from './sitesearch';
import { createTodoTool } from './todo';
import { createWebFetchTool } from './web-fetch';
import { createWebSearchTool } from './web-search';

// ============ 类型 ============

/** 内置工具装配依赖（可注入以便测试）。 */
export interface RegisterBuiltinToolsDeps {
  todoStore?: TodoStore;
  /** 预置沙箱后端；缺省时按 security.sandbox.backend 自动解析。 */
  sandbox?: SandboxBackend;
  /** 预置搜索提供商；缺省时按 security.webSearch.provider 解析（内置 duckduckgo）。 */
  searchProvider?: SearchProvider;
  fetchImpl?: FetchLike;
  /** 沙箱解析函数（可注入，便于测试不可用场景）。 */
  resolveSandbox?: (kind: SandboxBackendKind, options: SandboxBackendOptions) => SandboxResolution;
}

// ============ utils re-export ============

export { type FetchLike, type HttpResponse, defaultFetch } from '../utils/http';
export { type SearchProvider, type SearchResult, type SearchOptions } from '../utils/search';
export { createDuckDuckGoSearchProvider } from '../utils/duckduckgo';
export { resolveWithinRoot } from '../utils/path';
export { isDomainAllowed, type DomainPolicy } from '../utils/domain';
export { TodoStore, type TodoItem, type TodoStatus } from '../utils/todo-store';
export { checkBashPolicy } from '../utils/bash-policy';

// ============ tools re-export ============

export { createTodoTool, type TodoInput, type TodoResult, TODO_PLANNING_GUIDANCE } from './todo';
export {
  createReadFileTool,
  createWriteFileTool,
  type ReadFileInput,
  type ReadFileResult,
  type WriteFileInput,
  type WriteFileResult,
} from './file';
export { createBashTool, type BashInput } from './bash';
export { createWebSearchTool, type WebSearchInput, type WebSearchResult } from './web-search';
export { createWebFetchTool, type WebFetchInput, type WebFetchResult } from './web-fetch';
export { createSiteSearchTool, type SiteSearchInput, type SiteSearchResult } from './sitesearch';
export { createCalculatorTool, type CalculatorInput, type CalculatorResult } from './calculator';
export { createDatetimeTool, type DatetimeInput, type DatetimeResult } from './datetime';
export { createJsonTool, type JsonInput, type JsonResult } from './json';
export { createBase64Tool, type Base64Input, type Base64Result } from './base64';

// ============ 装配 ============

/** 按 security.webSearch.provider 解析搜索提供商（内置 duckduckgo；预置 provider 优先）。 */
function resolveSearchProvider(
  security: SecurityConfig,
  deps: RegisterBuiltinToolsDeps,
): SearchProvider {
  if (deps.searchProvider) return deps.searchProvider;
  const name = security.webSearch.provider;
  if (name === 'duckduckgo') return createDuckDuckGoSearchProvider(deps.fetchImpl);
  throw new Error(`Unknown search provider "${name}" (built-in: duckduckgo)`);
}

/**
 * 统一装配内置工具：内置工具是系统默认能力，**恒全注册**（todo 规划原语 + read_file /
 * write_file / web_search / web_fetch / sitesearch / calculator / datetime / json / base64）。
 * `tools` 配置是「额外工具引用」的横向拓展，不参与内置工具过滤。bash 仍仅当
 * `security.bash.enabled` 时注册（无沙箱则抛错，绝不裸奔）。
 */
export function registerBuiltinTools(
  registry: ToolRegistry,
  security: SecurityConfig,
  deps: RegisterBuiltinToolsDeps = {},
): string[] {
  const registered: string[] = [];

  // todo 是任务规划原语（AGENTS.md 6.2），始终注册。
  registry.register(createTodoTool(deps.todoStore ?? new TodoStore()));
  registered.push('builtin.todo');

  registry.register(createReadFileTool(security.files));
  registered.push('builtin.read_file');

  registry.register(createWriteFileTool(security.files));
  registered.push('builtin.write_file');

  registry.register(createWebSearchTool(resolveSearchProvider(security, deps), security.webSearch));
  registered.push('builtin.web_search');

  registry.register(createWebFetchTool(security.webFetch, deps.fetchImpl));
  registered.push('builtin.web_fetch');

  registry.register(
    createSiteSearchTool(resolveSearchProvider(security, deps), security.webSearch),
  );
  registered.push('builtin.sitesearch');

  registry.register(createCalculatorTool());
  registered.push('builtin.calculator');

  registry.register(createDatetimeTool());
  registered.push('builtin.datetime');

  registry.register(createJsonTool());
  registered.push('builtin.json');

  registry.register(createBase64Tool());
  registered.push('builtin.base64');

  if (security.bash.enabled) {
    let sandbox = deps.sandbox;
    if (!sandbox) {
      const resolveSandbox = deps.resolveSandbox ?? resolveSandboxBackend;
      const resolution = resolveSandbox(security.sandbox.backend, {
        workspaceRoot: security.sandbox.workspaceRoot,
        image: security.sandbox.image,
        compact: security.sandbox.compact,
      });
      if (!resolution.available) {
        throw new Error(`bash enabled but no sandbox available: ${resolution.reason}`);
      }
      sandbox = resolution.backend;
    }
    registry.register(createBashTool(security.bash, sandbox));
    registered.push('builtin.bash');
  }

  return registered;
}
