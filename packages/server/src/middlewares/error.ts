import type { ErrorHandler } from 'hono';
import type { Logger } from '../logger';

/** 带 HTTP 状态码与可选 details 的领域错误；handler 抛出，由全局 errorHandler 统一映射。 */
export class HttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

/** 全局错误处理器：`HttpError` 按 status/message/details 映射，未知错误统一 500。 */
export function createErrorHandler(logger: Logger): ErrorHandler {
  return (err, c) => {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof HttpError ? err.message : 'internal server error';
    const details =
      err instanceof HttpError ? err.details : err instanceof Error ? err.message : String(err);

    logger.error({ err }, message);
    return c.json(
      { error: message, ...(details !== undefined ? { details } : {}) },
      status as never,
    );
  };
}
