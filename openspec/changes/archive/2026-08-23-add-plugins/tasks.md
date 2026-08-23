## 1. Plugin 类型与收集（core/plugins/）

- [x] 1.1 定义 `Plugin` / `PluginContext` / `PluginAssembly` 类型
- [x] 1.2 实现 `PluginManager`（install / installAll → PluginAssembly）

## 2. 装配工厂（core/agent/）

- [x] 2.1 实现 `assembleAgentLoop`（async：install plugins + 合并能力 + 构造 AgentLoop）

## 3. 导出

- [x] 3.1 core 导出 Plugin / PluginContext / PluginAssembly / PluginManager / assembleAgentLoop

## 4. 测试（含可观测 console.log）

- [x] 4.1 PluginManager 收集测试
- [x] 4.2 assembleAgentLoop 装配测试（plugin tool 生效）
