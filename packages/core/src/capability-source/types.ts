import type { Skill } from '../skills/types';

/** 归一化后的 MCP server（command 形态，registry 来源已转成 npx）。 */
export interface ResolvedMcpServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/** 技能来源解析依赖（命令执行 / 临时目录可注入，便于测试）。 */
export interface SkillSourceDeps {
  /** 执行外部命令（如 npm / git / tar）。 */
  exec(command: string, args: string[], options?: { cwd?: string }): Promise<void>;
  /** 创建临时目录。 */
  mkdtemp(): Promise<string>;
  /** 递归删除临时目录（幂等）。 */
  rm(dir: string): Promise<void>;
  /** 从拉取到的目录中定位并加载 SKILL.md。 */
  readSkill(dir: string): Promise<Skill>;
}
