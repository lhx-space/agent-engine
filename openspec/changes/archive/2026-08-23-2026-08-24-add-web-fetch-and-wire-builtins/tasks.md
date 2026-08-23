## 1. config schema

- [x] 1.1 抽出 `WebPolicySchema`（allowDomains / denyDomains / timeoutMs / maxOutputBytes）
- [x] 1.2 `WebSearchPolicySchema = WebPolicySchema.extend({ endpoint })`
- [x] 1.3 `SecurityConfig` 新增 `webFetch: WebPolicySchema`

## 2. web_fetch 工具

- [x] 2.1 `isDomainAllowed` 收敛为结构型 `DomainPolicy`
- [x] 2.2 实现 `createWebFetchTool`（url → fetch → 文本 + domain/超时/截断）

## 3. registerBuiltinTools 过滤 + 装配

- [x] 3.1 `registerBuiltinTools` 增 `deps.tools`（ToolRef[]）过滤，todo 恒注册，新增 web_fetch
- [x] 3.2 `assembleAgentLoop` 增 `security` / `tools` / `sandbox` 选项并接线

## 4. 导出与测试

- [x] 4.1 导出 web_fetch（web-fetch.ts / builtin/index.ts / core index.ts / types.ts）
- [x] 4.2 web_fetch 测试（放行 / 拒绝 / 截断）
- [x] 4.3 registerBuiltinTools tools 过滤测试
- [x] 4.4 assembleAgentLoop 接线测试（传 security 注册内置工具）
- [x] 4.5 demo.test.ts 升级为真实内置工具
