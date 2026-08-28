import type { Hook } from '@lhx-agent-engine/core';

/** 审计日志 hook：观察会话/步/工具调用（不改写、不阻断）。 */
const auditLog: Hook = {
  name: 'audit-log',
  async onSessionStart() {
    console.log('[audit-log] 会话开始');
  },
  async onStepEnd(step: number) {
    console.log(`[audit-log] 第 ${step} 步结束`);
  },
  async afterToolCall(name: string) {
    console.log(`[audit-log] 工具 ${name} 执行完成`);
  },
};

export default auditLog;
