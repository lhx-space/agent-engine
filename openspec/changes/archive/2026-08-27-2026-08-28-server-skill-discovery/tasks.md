## 1. preset-default 补 otel

- [x] 1.1 package.json 加 plugin-otel 依赖
- [x] 1.2 createPresetPluginFactories 加 otel 工厂

## 2. server skill 发现

- [x] 2.1 skill-store.ts（createNpxSkillDiscoverer + parseSkillList + stripAnsi）
- [x] 2.2 app.ts 加 3 端点 + ServerOptions.skillDiscoverer
- [x] 2.3 index.ts 导出 skill-store

## 3. 测试

- [x] 3.1 skill-store.test.ts（parseSkillList + discover/install）
- [x] 3.2 skill-api.test.ts（3 端点 + 400 兜底）

## 4. 示例

- [x] 4.1 agents/devops-agent.yaml（端到端验证目标）

## 5. 校验

- [x] 5.1 pnpm test / typecheck / lint / spell / format:check / lint:md / build
- [x] 5.2 openspec validate --strict
