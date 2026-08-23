# config-loading Specification

## Purpose

TBD - created by archiving change add-config-schema. Update Purpose after archive.

## Requirements

### Requirement: 三格式加载

系统 SHALL 提供 `loadAgentConfig(path)`，根据文件扩展名选择解析器：`.yaml`/`.yml` → `yaml`，`.json`/`.json5` → `json5`，`.ts`/`.mts` → `jiti`。

#### Scenario: YAML 加载

- **WHEN** 传入 `.yaml` 文件路径
- **THEN** 返回经 `AgentConfigSchema.parse()` 校验的 `AgentConfig`

#### Scenario: JSON5 加载

- **WHEN** 传入 `.json` 或 `.json5` 文件路径
- **THEN** 返回经校验的 `AgentConfig`，且支持注释

#### Scenario: TypeScript 加载

- **WHEN** 传入 `.ts` 文件路径且其 `default` 导出为配置对象
- **THEN** 返回经校验的 `AgentConfig`

### Requirement: 归一化等价

三种格式 SHALL 加载后产出等价的 `AgentConfig`（同一逻辑配置在三种格式下字段值一致）。

#### Scenario: 三格式契约一致

- **WHEN** 用 YAML、JSON5、TypeScript 分别表达同一份配置并加载
- **THEN** 三份 `AgentConfig` 深度相等

### Requirement: 校验失败报错

加载或校验失败 SHALL 抛出包含文件路径与原因的可读错误。

#### Scenario: 非法配置报错

- **WHEN** 配置缺失必填字段或格式非法
- **THEN** 抛出包含文件路径与 Zod 校验原因的错误
