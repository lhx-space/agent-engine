## 1. 安全原语（security.ts）

- [x] 1.1 实现 `DANGEROUS_KEYS`（`__proto__` / `constructor` / `prototype`）与 `sanitizeConfigValue`（递归剔除危险 key）
- [x] 1.2 实现 `deepFreeze`（递归冻结纯对象/数组，WeakSet 防环，跳过非 plain 值）

## 2. loader 加固（index.ts）

- [x] 2.1 新增 `LoadAgentConfigOptions`（`allowTsConfig` / `maxFileBytes`），`loadAgentConfig(path, options?)`
- [x] 2.2 解析前 `stat` 限制文件大小（默认 1 MiB）
- [x] 2.3 YAML `parse` 显式 `maxAliasCount` + `uniqueKeys: true`
- [x] 2.4 TS 配置默认拒绝，仅 `allowTsConfig: true` 时 jiti 加载
- [x] 2.5 校验前 `sanitizeConfigValue`，校验后 `deepFreeze`

## 3. 导出与测试

- [x] 3.1 `packages/config/src/index.ts` 导出 `LoadAgentConfigOptions` / `sanitizeConfigValue` / `deepFreeze`
- [x] 3.2 更新既有三格式测试（TS 传入 `allowTsConfig: true`）
- [x] 3.3 新增安全单测：原型污染剔除、deepFreeze 不可变、TS 默认拒绝、超大文件拒绝、别名炸弹拒绝
