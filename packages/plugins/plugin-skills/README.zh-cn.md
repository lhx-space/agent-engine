# @agent-engine/plugin-skills

技能插件：注册一个 `ContextContributor`，每次 run 检索命中的技能，注入 `instruction` 文本 + 捆绑 `tools`（run 内临时注册）。同时提供 `loadSkillFromPath`（SKILL.md 加载）与 `resolveSkill`/`resolveSkills`（path / npm / git 来源解析）。

插件自建索引（MiniSearch + 可选 `InMemoryVectorStore`），检索编排复用 core 的 `hybridRetrieve`——不依赖 core 的 `CapabilityLoader`/`CapabilityRegistry`。

## 安装

```bash
pnpm add @agent-engine/plugin-skills
```

## 用法

```ts
import { createSkillsPlugin, resolveSkills } from '@agent-engine/plugin-skills';

const { skills, dispose } = await resolveSkills(config.skills);
const skillsPlugin = createSkillsPlugin(skills, {
  embedding: embeddingProvider, // 可选；不传时仅 BM25
  topK: 5,
});

// 装配时传入 plugins: [skillsPlugin]
```

> 配置里的 `skills` 切片由本插件解释（D1-A：字段不变、零迁移）。装配由组合层（Phase 4 的 `@agent-engine/preset-default`）提供。
>
> ```yaml
> skills:
>   - source: path
>     path: ./skills/incident-response
> ```

## API

- `createSkillsPlugin(skills, options?)` — 返回注册 `ContextContributor` 的 `Plugin`。
- `loadSkillFromPath(path)` — 加载 SKILL.md 文件。
- `resolveSkill(ref, deps?)` / `resolveSkills(refs, deps?)` — 解析 path / npm / git 来源。
- `SkillsPluginOptions` — `{ embedding?, topK? }`。
