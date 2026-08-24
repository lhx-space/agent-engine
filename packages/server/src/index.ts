/**
 * @agent-engine/server —— HTTP 服务。
 * 对外提供 REST API（`/api/agent/run`），供 apps/web 与外部系统调用。
 */
export { createApp } from './app';
export { serve } from './serve';
export { envProviderFactory, resolveEnvApiKey } from './provider';
export type { ServerOptions } from './types';
