import type { SandboxBackendKind, SecurityConfig, ToolRef } from '@agent-engine/config';
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
  /** 配置声明的工具引用（`builtin.<name>`）；缺省/空 = 注册全部。 */
  tools?: ToolRef[];
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
 * 统一装配内置工具：todo 恒注册（规划原语）；其余工具按 `deps.tools`（`ToolRef[]`，缺省 = 全部）
 * 过滤；bash 仅 security.bash.enabled 且被请求时注册（无沙箱则抛错，绝不裸奔）。
 */
export function registerBuiltinTools(
  registry: ToolRegistry,
  security: SecurityConfig,
  deps: RegisterBuiltinToolsDeps = {},
): string[] {
  const tools = deps.tools;
  const want = (name: string): boolean => {
    if (!tools || tools.length === 0) return true;
    return tools.some((tool) => tool.use === `builtin.${name}`);
  };

  const registered: string[] = [];

  // todo 是任务规划原语（AGENTS.md 6.2），始终注册，不受 tools 过滤影响。
  registry.register(createTodoTool(deps.todoStore ?? new TodoStore()));
  registered.push('builtin.todo');

  if (want('read_file')) {
    registry.register(createReadFileTool(security.files));
    registered.push('builtin.read_file');
  }
  if (want('write_file')) {
    registry.register(createWriteFileTool(security.files));
    registered.push('builtin.write_file');
  }
  if (want('web_search')) {
    registry.register(
      createWebSearchTool(resolveSearchProvider(security, deps), security.webSearch),
    );
    registered.push('builtin.web_search');
  }
  if (want('web_fetch')) {
    registry.register(createWebFetchTool(security.webFetch, deps.fetchImpl));
    registered.push('builtin.web_fetch');
  }
  if (want('sitesearch')) {
    registry.register(
      createSiteSearchTool(resolveSearchProvider(security, deps), security.webSearch),
    );
    registered.push('builtin.sitesearch');
  }
  if (want('calculator')) {
    registry.register(createCalculatorTool());
    registered.push('builtin.calculator');
  }
  if (want('datetime')) {
    registry.register(createDatetimeTool());
    registered.push('builtin.datetime');
  }
  if (want('json')) {
    registry.register(createJsonTool());
    registered.push('builtin.json');
  }
  if (want('base64')) {
    registry.register(createBase64Tool());
    registered.push('builtin.base64');
  }

  if (security.bash.enabled && want('bash')) {
    let sandbox = deps.sandbox;
    if (!sandbox) {
      const resolveSandbox = deps.resolveSandbox ?? resolveSandboxBackend;
      const resolution = resolveSandbox(security.sandbox.backend, {
        workspaceRoot: security.sandbox.workspaceRoot,
        image: security.sandbox.image,
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
