import type { Context } from 'hono';
import { HttpError } from '../middlewares/error';

/** 解析请求体 JSON；非法抛出 `HttpError(400)`。 */
export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, 'invalid JSON body');
  }
}
