# @lhx-agent-engine/plugin-skills

Skills plugin: registers a `ContextContributor` that retrieves matching skills on every run and injects their `instruction` text + bundled `tools` (run-scoped). Also provides `loadSkillFromPath` (SKILL.md) and `resolveSkill`/`resolveSkills` (path / npm / git sources).

The plugin builds its own index (MiniSearch + optional `InMemoryVectorStore`) and reuses core's `hybridRetrieve` for retrieval orchestration — it does not depend on core's `CapabilityLoader`/`CapabilityRegistry`.

## Install

```bash
pnpm add @lhx-agent-engine/plugin-skills
```

## Usage

```ts
import { createSkillsPlugin, resolveSkills } from '@lhx-agent-engine/plugin-skills';

const { skills, dispose } = await resolveSkills(config.skills);
const skillsPlugin = createSkillsPlugin(skills, {
  embedding: embeddingProvider, // optional; BM25-only when omitted
  topK: 5,
});

// 装配时传入 plugins: [skillsPlugin]
```

> In config, the `skills` slice is interpreted by this plugin (D1-A: field unchanged, zero migration). Assembly is provided by the composition layer (`@lhx-agent-engine/preset-default` in Phase 4).
>
> ```yaml
> skills:
>   - source: path
>     path: ./skills/incident-response
> ```

## API

- `createSkillsPlugin(skills, options?)` — returns a `Plugin` that registers a `ContextContributor`.
- `loadSkillFromPath(path)` — loads a SKILL.md file.
- `resolveSkill(ref, deps?)` / `resolveSkills(refs, deps?)` — resolve path / npm / git sources.
- `SkillsPluginOptions` — `{ embedding?, topK? }`.
