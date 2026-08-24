import { serve as nodeServe } from '@hono/node-server';
import { createApp } from './app';
import type { ServerOptions } from './types';

/** 启动 HTTP 服务监听。 */
export function serve(options: ServerOptions = {}, port = 8080) {
  return nodeServe({ fetch: createApp(options).fetch, port });
}
