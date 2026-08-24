## Context

配置加载是 Agent 内核的**信任边界入口**。M3 resolve 层开工前，先补「入口 sanitize + 出口 deepFreeze + 资源限制 + TS 显式开关」四道防线，复用现有原语（`Object.freeze` 递归 / `yaml` 内置选项 / `fs.stat`），不引新依赖。

## Goals / Non-Goals

**Goals:**

- TS 配置默认拒绝（`jiti` 会执行代码），仅 `allowTsConfig: true` 显式开启。
- 校验前递归剔除 `__proto__` / `constructor` / `prototype`，防原型污染。
- 校验后 `deepFreeze`，防运行时篡改。
- 文件大小上限 + YAML `maxAliasCount` / `uniqueKeys`，防解析炸弹。

**Non-Goals:**

- 不引入 JSON Schema 校验器、也不沙箱化运行 TS 配置（TS 仅限受信任本地输入）。
- 不实现 `${ENV}` 插值 allowlist（`mcp.env` 插值留 resolve/M3）。

## Decisions

### D1: TS 默认拒绝，显式开关

**选择**：`loadAgentConfig(path, { allowTsConfig })`；命中 TS 扩展名且未开启时，在 `stat` 之前直接拒绝。

**理由**：`jiti.import` 执行任意代码 = RCE；TS 仅限本地受信任输入，生产/热挂载只走 YAML/JSON。

### D2: sanitize 重建新对象，而非只删 key

**选择**：`sanitizeConfigValue` 递归「重建为全新普通对象」并跳过危险 key。

**理由**：即便源对象原型已被污染，重建也能隔离；比「只删 key」更强。

### D3: deepFreeze 只冻 plain 值 + WeakSet 防环

**选择**：递归 `Object.freeze`，仅纯对象 / 数组 / 空原型对象；跳过 Date / Map / 类实例；`WeakSet` 防环与共享引用。

**理由**：`Object.freeze` 是浅冻结；冻结类实例会破坏其内部状态。

### D4: 资源限制复用 yaml 内置选项

**选择**：`parseYaml(raw, { maxAliasCount: 100, uniqueKeys: true })`；解析前 `stat` 限 1 MiB。

**理由**：`yaml` v2 已内置防别名炸弹 / 重复 key，不自研解析防护。

## Risks / Trade-offs

- [TS 拒绝可能破坏既有 TS 配置用法] → 显式 `allowTsConfig: true` 迁移，测试同步更新。
- [deepFreeze 后配置不可变] → 插件 / hook 若要改配置需显式拷贝；这是预期安全语义。
- [sanitize 重建丢失非枚举/符号属性] → 配置数据来自 YAML/JSON/TS 普通对象，无此场景。

## Migration Plan

`loadAgentConfig` 调用方：TS 配置需加 `{ allowTsConfig: true }`；其余无感。
