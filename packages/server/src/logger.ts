import { pino } from 'pino';

/** server 层结构化日志（pino）。核心只产出事件，日志策略在部署层。 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'agent-engine-server' },
});
