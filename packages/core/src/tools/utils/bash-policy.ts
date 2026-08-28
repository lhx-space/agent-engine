import type { BashPolicy } from '@lhx-agent-engine/config';

/** 校验命令策略：黑名单（子串匹配）→ 白名单（空 = 不限制）。返回阻断原因，undefined 表示放行。 */
export function checkBashPolicy(
  policy: BashPolicy,
  command: string,
  args: string[],
): string | undefined {
  const fullCommand = [command, ...args].join(' ');
  for (const pattern of policy.denyPatterns) {
    if (fullCommand.includes(pattern)) {
      return `command matches deny pattern "${pattern}"`;
    }
  }
  if (policy.allowCommands.length > 0 && !policy.allowCommands.includes(command)) {
    return `command "${command}" is not in allowCommands`;
  }
  return undefined;
}
