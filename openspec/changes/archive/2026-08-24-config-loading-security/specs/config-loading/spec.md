## MODIFIED Requirements

### Requirement: 三格式加载

系统 SHALL 提供 `loadAgentConfig(path, options?)`，根据文件扩展名选择解析器：`.yaml`/`.yml` → `yaml`，`.json`/`.json5` → `json5`；`.ts`/`.mts`/`.cts` → `jiti`，但**仅当 `options.allowTsConfig` 为 `true` 时**允许加载（默认拒绝）。

#### Scenario: YAML 加载

- **WHEN** 传入 `.yaml` 文件路径
- **THEN** 返回经 `AgentConfigSchema.parse()` 校验且深度冻结的 `AgentConfig`

#### Scenario: JSON5 加载

- **WHEN** 传入 `.json` 或 `.json5` 文件路径
- **THEN** 返回经校验且深度冻结的 `AgentConfig`，且支持注释

#### Scenario: TypeScript 默认拒绝

- **WHEN** 传入 `.ts` / `.mts` / `.cts` 文件路径且未显式 `allowTsConfig: true`
- **THEN** 抛出包含「TypeScript 配置默认禁用」提示的错误，不执行该文件

#### Scenario: TypeScript 显式允许

- **WHEN** 传入 `.ts` 文件路径且 `allowTsConfig: true`
- **THEN** 经 jiti 加载其 `default` 导出并校验为 `AgentConfig`

## ADDED Requirements

### Requirement: 入口安全防护（原型污染）

系统 SHALL 在 Zod 校验前对解析结果递归剔除 `__proto__` / `constructor` / `prototype` 危险 key，防止原型污染。

#### Scenario: 危险 key 被剔除

- **WHEN** 配置 `variables` 或任意位置含 `__proto__` / `constructor` / `prototype` key
- **THEN** 校验后产物中不含这些 key，且 `Object.prototype` 未被污染

### Requirement: 配置不可变（deepFreeze）

系统 SHALL 在校验后对 `AgentConfig` 及其嵌套对象/数组深度冻结（`Object.freeze` 递归），仅冻结纯对象与数组，跳过非 plain 值；产物在严格模式下不可写入。

#### Scenario: 深层字段不可改

- **WHEN** 校验通过后尝试改写 `config.security.bash.enabled` 等深层字段（严格模式）
- **THEN** 抛出 TypeError，配置保持不可变

#### Scenario: 数组元素不可改

- **WHEN** 尝试 `push` / 改写 `config.rules` 数组
- **THEN** 抛出 TypeError（数组已冻结）

### Requirement: 资源限制

系统 SHALL 在解析前限制配置文件大小（默认 1 MiB，可通过 options 覆盖），并以 `yaml.parse` 的 `maxAliasCount` 与 `uniqueKeys: true` 防 YAML 别名炸弹与重复 key。

#### Scenario: 超大文件拒绝

- **WHEN** 配置文件超过大小上限
- **THEN** 抛出包含文件路径与大小上限的错误

#### Scenario: YAML 别名炸弹拒绝

- **WHEN** YAML 使用超出 `maxAliasCount` 的别名展开
- **THEN** 抛出解析错误，不触发资源耗尽
