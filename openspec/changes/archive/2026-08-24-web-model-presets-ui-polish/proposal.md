## Why

当前 WebApp 的配置交互有两个痛点：

1. **模型配置要手填** `provider` / `baseURL` / `model` / `apiKey`，用户不知道怎么填（尤其 DeepSeek 的 anthropic 端点、R1 reasoner 等），门槛高、易错。
2. **配置面板与导出太啰嗦**：`security` 全量默认展开（5 个子块十几项），导出把全部默认值也写出来，一份配置一大半是噪声。

## What Changes

- **模型面板供应商预设**：提供 DeepSeek chat / DeepSeek reasoner / Anthropic / Ollama（本地）预设，一键填充 `provider` / `baseURL` / `model`（apiKey 仍留空 + 提示从环境变量注入）。
- **security 面板减负**：默认折叠，提供 preset（strict / balanced / permissive）快捷填充，只在需要时展开细调。
- **导出只导非默认值**：序列化前与默认配置做 diff，省略等于默认值的字段，导出的 YAML/JSON 更精简。

## Capabilities

### Modified Capabilities

- `web-editor`: model 配置交互（预设）、security 折叠/preset、导出减负。

## Impact

- 修改 `apps/web/src/panels/`（ModelForm / SecurityForm）、`apps/web/src/lib/export-config.ts`、`apps/web/src/App.tsx`（默认配置）。
- 复用现有 antd 组件；不改 config schema / core。
- 无 breaking changes。
