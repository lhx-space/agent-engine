## 1. 新增 plugin-skills 包

- [x] 1.1 `package.json` / `tsconfig.json` / `tsdown.config.ts`
- [x] 1.2 `src/{types,load,source,index}.ts`（Skill / loadSkillFromPath / resolveSkills / createSkillsPlugin）
- [x] 1.3 `README.md` / `README.zh-cn.md`

## 2. core 删除 skill 硬路径与能力轴

- [x] 2.1 删 `skills/` 目录、`capability-source/skill.ts`
- [x] 2.2 `PluginContext` / `CapabilityBundle` / `PluginManager` 删 skills
- [x] 2.3 `AgentLoop` / `ContextComposer` / `assemble` / `resolve` 删 skill 路径
- [x] 2.4 `buildSystemPrompt` 去 skillsText；`events` 删 skill.loaded
- [x] 2.5 `index.ts` / `types.ts` / `tsdown.config.ts` / `package.json` 同步

## 3. 测试迁移

- [x] 3.1 新增 `plugin-skills/tests/skills.test.ts`
- [x] 3.2 迁移 core 的 skills / capability-source / context-composer / context / demo / resolve 测试

## 4. 校验

- [x] 4.1 `pnpm test` / `typecheck` / `lint` / `spell` / `format:check` / `lint:md` / `build`
- [x] 4.2 `openspec validate --strict`
