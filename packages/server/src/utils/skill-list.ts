/** 从 skills.sh 输出解析出的单个 skill。 */
export interface ParsedSkill {
  name: string;
  description: string;
}

/** 剥离 ANSI 转义序列（色码 + TUI 光标控制）。 */
const ANSI_RE = /\x1b\[[0-9;?]*[a-zA-Z]/g;
export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}

/**
 * 解析 `npx skills add <repo> -l` 的输出为 skill 列表。
 * 输出形态（strip ANSI 后）：
 *   │    <skill-name>
 *   │
 *   │      <description>
 */
export function parseSkillList(output: string): ParsedSkill[] {
  const skills: ParsedSkill[] = [];
  let current: ParsedSkill | null = null;
  for (const rawLine of stripAnsi(output).split('\n')) {
    const line = rawLine.trimEnd();
    const nameMatch = line.match(/^│    (\S.*)$/);
    const descMatch = line.match(/^│      (.*)$/);
    if (nameMatch) {
      current = { name: nameMatch[1]!.trim(), description: '' };
      skills.push(current);
    } else if (descMatch && current) {
      const desc = descMatch[1]!.trim();
      current.description = current.description ? `${current.description} ${desc}` : desc;
    }
  }
  return skills;
}
