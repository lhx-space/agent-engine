# @lhx-agent-engine/plugin-files

Local file tool-suite plugin: registers `read_file` / `write_file` / `list_files`, constrained by `security.files.roots`.

## Install

```bash
pnpm add @lhx-agent-engine/plugin-files
```

## Usage

```ts
import { createFilesPlugin } from '@lhx-agent-engine/plugin-files';

const filesPlugin = createFilesPlugin({
  roots: ['/workspace'],
  maxFileBytes: 1_048_576,
});

// then assemble with plugins: [filesPlugin]
```

> Declare it in your config to have the server wire it automatically:
>
> ```yaml
> plugins:
>   - '@lhx-agent-engine/plugin-files'
> security:
>   files:
>     roots: [/workspace]
> ```

## Security

- `read_file` / `list_files` are read-only and constrained to `roots`.
- `write_file` writes within `roots` and enforces `maxFileBytes`.
