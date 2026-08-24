## Context

`slim-builtin-tools-plugin-files-bash` 的 D4 决定「鸡肋工具直接移除，不做按需开关」，但落地时保守地保留了 `tools/builtin/{json,base64,calculator,sitesearch}.ts` 源码（注释宣称「供 plugin 复用」）。事后没有任何 plugin 复用，成为死代码，且与「已移除」的事实矛盾。用户明确指出「还没有删除不要的工具文件」。

同时 `read_file` / `write_file` / `bash` 迁出为 plugin 包后，`builtin-tools/spec.md` 仍保留这三个的「内置工具」章节；calculator/json/base64/sitesearch 的四章也仍在，spec 与代码事实漂移。

## Goals / Non-Goals

**Goals:**

- 彻底删除 `base64` / `calculator` / `json` / `sitesearch` 四个源文件及全部引用（含测试、前端预设、`expr-eval` 依赖）。
- 修正 `builtin-tools` 主 spec：移除不再属于内置工具的 7 个需求章节，统一装配描述与代码一致。

**Non-Goals:**

- 不做 `list_files` / `glob`（plugin-files 的 P1 增强）。
- 不改 `tools` 配置语义（额外工具引用仍是后续 P2 的「内置开关」）。
- 不做搜索多 provider / web_fetch 修复（另一个 change）。

## Decisions

### D1: 直接删除，不迁移为 plugin

**选择**：`json` / `base64` / `calculator` / `sitesearch` 源码直接删除，不做「迁移到 plugin 包保留复用」。

**理由**：D4 已判定这些是「LLM 自己能做（json/base64/简单算术）」或「无效冗余（sitesearch）」的能力，无复用价值；保留源码只是制造维护负担与误导。确有需要时按 8.1 以 plugin/skill 重新提供即可。

### D2: 一并修正 `builtin-tools` 主 spec 漂移

**选择**：REMOVE `read_file` / `write_file` / `bash` / `calculator` / `json` / `base64` / `sitesearch` 七个需求章节（前三个已迁入 `plugins` spec，后四个已删除），MODIFY「统一装配」去掉「实现保留」措辞。

**理由**：`plugins/spec.md` 已有「内置 plugin（files / bash）」章节承载 read/write/bash 的真相，builtin-tools 主 spec 不应重复且矛盾地宣称它们是内置工具。

## Risks / Trade-offs

- [删除后无法回收实现] → 若未来确需 calculator/json/base64，需重新实现；但代价极低（均为一函数），且符合「复用优先」——真需要时优先找现成库（如 `expr-eval`）而非复活自研。

## Migration Plan

- 无配置迁移：这些工具原本就不在注册表里。
- 前端 `ToolsForm` 预设移除 4 个死名。
- 测试：删除 4 个工具的用例；`registerBuiltinTools` 的「不注册」断言保留为回归护栏。
