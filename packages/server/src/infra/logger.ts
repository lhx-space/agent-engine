/**
 * 日志抽象（server 层，可插拔）：日志不是服务必备能力，可观测真相源在 core 的
 * events 总线 + hooks（AOP）。默认 `consoleLogger`（零依赖兜底），pino / winston /
 * OTel 等结构化后端由用户经 `ServerOptions.logger` 注入（AOP 接入）。
 */

export interface Logger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  debug(obj: unknown, msg?: string): void;
}

/** 开发默认：console 输出（`(obj, msg?)` 形态与 pino/winston 对齐，替换零成本）。 */
export const consoleLogger: Logger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
  debug: (obj, msg) => console.debug(msg ?? '', obj),
};
