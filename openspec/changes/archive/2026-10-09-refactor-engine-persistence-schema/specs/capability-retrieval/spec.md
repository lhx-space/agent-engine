## MODIFIED Requirements

### Requirement: 语义检索后端（VectorStore + EmbeddingProvider）

`VectorStore` 的写入记录 SHALL 支持携带 `namespace`（隔离域）、`kind`（资产类型：memory / document / skill）、`refId`（指向来源记录）与 `content`（原文）；`query` SHALL 接受可选 `filter`（`namespace` / `kind`）用于按隔离域与类型过滤。所有新增字段 SHALL 为可选，不传时行为与现状一致。

`EmbeddingProvider` SHALL 暴露其产出的向量维度（`dimension`）与模型标识（`name`），供存储层在建表与写入校验时使用。

#### Scenario: 按命名空间隔离检索

- **WHEN** 以 `namespace='devops-agent:memory'` 写入向量，再以同 namespace 查询
- **THEN** 仅返回该 namespace 下的向量，其他 agent 的向量不出现在结果中

#### Scenario: 不传 filter 时向后兼容

- **WHEN** 调用 `query(vector, topK)` 不传第三参数
- **THEN** 行为与变更前一致（全量检索），不报错

#### Scenario: 维度不符显式报错

- **WHEN** 向声明为 `vector(1024)` 的表写入长度为 1536 的向量
- **THEN** 抛出明确错误（含期望维度与实际维度），不得静默写入

#### Scenario: 召回直接得到原文

- **WHEN** 写入时带 `content`，随后查询
- **THEN** 返回的匹配项直接包含原文，无需二次查询其他存储
