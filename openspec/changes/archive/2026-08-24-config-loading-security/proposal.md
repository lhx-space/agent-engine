## Why

配置加载是 Agent 内核的**信任边界入口**：`loadAgentConfig` 目前「裸读文件 → 裸解析 → Zod」，存在四类安全隐患，必须在 M3 resolve 层接入前补齐：

1. **TS 配置即代码执行（最高危）**：`jiti.import(path)` 会把 `.ts` 配置当代码跑。配置一旦来自不可信来源（热挂载的 `agents/` 目录、被投毒的仓库、PR 把 `.yaml` 换成 `.ts`），即可在 kernel 进程内读 env、联网、spawn 子进程——数据变成了代码。
2. **原型污染**：解析结果携带 `__proto__` / `constructor` / `prototype` key 时，后续 merge/展开可能污染 `Object.prototype`。Zod `.object()` 默认 strip 未知 key 已是一道防线，但 `variables` / `mcp.env` 等 `z.record(..., z.unknown())` 是「任意值」，仍存污染面。
3. **配置被篡改**：校验后的 `AgentConfig` 是可变对象，插件 / hook / rule 或后续代码可在运行时改写共享配置，跨 session 串味/投毒。
4. **资源耗尽**：YAML 别名炸弹（billion laughs）、超深嵌套、超大文件，可导致解析阶段 CPU/内存耗尽。

本 change 在 `config` 包落地「入口 sanitize + 出口 deepFreeze + 资源限制 + TS 显式开关」四道防线，全部复用现有原语（`Object.freeze` 递归、`yaml` 的 `maxAliasCount` / `uniqueKeys`、`fs.stat`），不引入任何新三方依赖。

## What Changes

- `loadAgentConfig(path)` 增加可选 `options`（`allowTsConfig` / `maxFileBytes`）。
- **TS 配置默认拒绝**：`.ts` / `.mts` / `.cts` 仅在 `allowTsConfig: true` 时经 jiti 加载，否则抛错；默认只接受 YAML / JSON(5)。
- **入口 sanitize**：校验前递归剔除 `__proto__` / `constructor` / `prototype` 危险 key。
- **出口 deepFreeze**：校验后深度冻结产物（纯对象与数组），使配置不可变。
- **资源限制**：解析前 `stat` 限制文件大小（默认 1 MiB）；`yaml.parse` 显式 `maxAliasCount` + `uniqueKeys: true` 防别名炸弹与重复 key。

## Capabilities

### Modified Capabilities

- `config-loading`：`loadAgentConfig` 签名扩展 + TS 默认拒绝 + 新增「入口安全防护」「配置不可变」「资源限制」三条 requirement。

## Impact

- 新增 `packages/config/src/loader/security.ts`（`sanitizeConfigValue` / `deepFreeze` / `DANGEROUS_KEYS`）。
- 扩展 `packages/config/src/loader/index.ts`（options + 大小限制 + yaml 选项 + sanitize + deepFreeze）。
- 扩展 `packages/config/src/index.ts` 导出（`LoadAgentConfigOptions` / `sanitizeConfigValue` / `deepFreeze`）。
- 新增/扩展 `packages/config/tests/loader.test.ts` 安全单测。
- 无新增三方依赖。
- **行为变更（安全加固）**：`.ts` 配置默认拒绝，需 `allowTsConfig: true`；已有测试同步更新。
