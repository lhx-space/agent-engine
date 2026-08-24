## 1. CapabilityBundle 统一

- [x] 1.1 定义 `CapabilityBundle`（tools/skills/hooks/rules/promptFragments/dispose?）
- [x] 1.2 `PluginAssembly` 泛化为 `CapabilityBundle`（补 dispose）
- [x] 1.3 `connectMcpServers` 产出 bundle（tools + dispose 关闭连接）

## 2. loop 回归纯原语

- [x] 2.1 `AgentLoop` 移除 `mcpConnections` / `dispose`
- [x] 2.2 `agent/types.ts` 移除 `mcpConnections?`

## 3. mergeBundles

- [x] 3.1 实现 `mergeBundles(bundles)` → `{ tools, skills, hooks, rules, promptFragments, dispose }`
- [x] 3.2 `assembleAgentLoop` 内部改用 `mergeBundles`

## 4. resolveAgentConfig

- [x] 4.1 `resolveAgentConfig(config, deps?)`：provider（可注入 factory）+ builtin（registerBuiltinTools）+ plugins（按名）+ mcp（connect）+ skills（loadSkillFromPath）+ rules + memory + systemPrompt + security
- [x] 4.2 plugin 工厂表 `deps.pluginFactories`，缺失报可读错误
- [x] 4.3 返回 `ResolvedAgent`（agent + dispose 聚合）

## 5. 导出与测试

- [x] 5.1 `core/src/index.ts` 导出 resolve 类型与工厂
- [x] 5.2 `resolve.test.ts`：mergeBundles + 完整配置装配 + dispose 幂等 + plugin 名缺失报错
- [x] 5.3 更新受影响的 loop/plugins/demo 测试

## 6. 文档

- [x] 6.1 AGENTS.md 目录结构修正：resolve 层在 core，config/resolve 只做配置级归一化
