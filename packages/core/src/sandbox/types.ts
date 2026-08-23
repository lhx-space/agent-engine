/** 沙箱执行请求：声明要执行的命令及其资源/网络约束。 */
export interface SandboxExecRequest {
  command: string;
  args?: string[];
  /** 沙箱内工作目录。 */
  cwd?: string;
  /** 显式透传的环境变量（不含任何密钥，密钥由部署层注入）。 */
  env?: Record<string, string>;
  timeoutMs?: number;
  maxOutputBytes?: number;
  /** 网络策略：none（默认，隔离）/ allowed（开放）。 */
  network?: 'none' | 'allowed';
  /** 资源限制（各后端映射：docker 用 --memory/--cpus/--pids-limit，nsjail 用 --rlimit_as/--rlimit_cpu）。 */
  limits?: { cpu?: string; memory?: string; pids?: number };
  /** 输出压缩：true 时以 rtk 包装命令（`rtk <command> <args>`）。 */
  compact?: boolean;
}

/** 沙箱执行结果。 */
export interface SandboxExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  /** 输出是否因超过 maxOutputBytes 被截断。 */
  truncated: boolean;
}

/** 沙箱后端通用选项。 */
export interface SandboxBackendOptions {
  /** 挂载进沙箱的工作区根目录。 */
  workspaceRoot?: string;
  /** docker 后端使用的镜像。 */
  image?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  env?: Record<string, string>;
  /** 输出压缩默认值（来自 security.sandbox.compact；单次请求可覆盖）。 */
  compact?: boolean;
}

/** 沙箱后端接口：聚焦「隔离执行原生命令」。 */
export interface SandboxBackend {
  readonly kind: 'docker' | 'nsjail';
  exec(req: SandboxExecRequest): Promise<SandboxExecResult>;
}

/** 沙箱不可用错误（无可用后端时抛出，上层据此禁用 bash）。 */
export class SandboxUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxUnavailableError';
  }
}

/** 沙箱解析结果：可用则带后端，不可用则带原因。 */
export type SandboxResolution =
  { available: true; backend: SandboxBackend } | { available: false; reason: string };

/** 后端工厂探测依赖（可注入以便测试）。 */
export interface ResolveSandboxDeps {
  hasBinary?: (bin: string) => boolean;
  platform?: NodeJS.Platform;
}
