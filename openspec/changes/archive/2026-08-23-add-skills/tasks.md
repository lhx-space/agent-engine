## 1. Skill 类型与检索（core/skills/）

- [x] 1.1 定义 `Skill` 类型（name / description / instruction / tools / tags）
- [x] 1.2 实现 `SkillLoader`（注册进 CapabilityRegistry，loadForQuery 返回命中 skills）
- [x] 1.3 实现 `loadSkillFromPath`（gray-matter 解析 SKILL.md）

## 2. buildSystemPrompt 扩展（core/context/）

- [x] 2.1 增加 `skills` 参数（命中 skills 指令拼接文本）
- [x] 2.2 内置 `{{skills}}` 变量 + 未声明占位符兜底追加

## 3. AgentLoop 集成（core/agent/）

- [x] 3.1 `AgentLoopOptions.skills?: Skill[]`
- [x] 3.2 run 时检索命中 skills，指令注入 + 捆绑工具注册

## 4. 导出

- [x] 4.1 core 导出 Skill / SkillLoader / loadSkillFromPath

## 5. 测试（含可观测 console.log）

- [x] 5.1 SkillLoader 检索测试（命中 / 未命中）
- [x] 5.2 loadSkillFromPath 测试（frontmatter + 正文）
- [x] 5.3 buildSystemPrompt {{skills}} 注入测试
- [x] 5.4 AgentLoop skill 集成测试（指令注入 + 工具注册）
- [x] 5.5 端到端 demo 测试（mock LLM，console.log 打印完整执行过程）
