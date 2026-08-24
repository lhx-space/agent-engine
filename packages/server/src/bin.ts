import { serve } from './serve';

/**
 * 服务启动入口（开发/演示用）：
 *   PORT=8080 pnpm --filter @agent-engine/server dev
 *
 * 生产环境由部署层（Docker / 编排）调用 `serve(options, port)` 并注入
 * pluginFactories / providerFactory，本入口只做最小默认启动。
 */
const port = Number(process.env.PORT ?? 8080);
serve({}, port);
console.log(`[agent-engine] server listening on http://localhost:${port}`);
