## MODIFIED Requirements

### Requirement: rules 配置

系统 SHALL 定义 `rules` 子 Schema，每条规则含 `id`、`kind`（always / on-demand，加载策略）、`description`（meta 匹配面）、`content`（markdown 正文）、`tags`（同义词数组）；`kind` 未显式声明时 SHALL 默认为 `on-demand`。

#### Scenario: always 规则

- **WHEN** 一条 `kind='always'` 的规则
- **THEN** 该规则加载时强制注入，绕过检索

#### Scenario: on-demand 规则默认值

- **WHEN** 一条规则未声明 `kind`
- **THEN** 解析后 `kind` 为 `on-demand`，参与检索

#### Scenario: 规则含 content 与 tags

- **WHEN** 一条规则声明 `description`、`content`、`tags`
- **THEN** 校验通过，`tags` 作为同义词参与检索索引
