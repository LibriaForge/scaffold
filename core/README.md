# @libria/scaffold-core

Shared types and utilities used by `@libria/scaffold` and its template plugins.

![Version](https://img.shields.io/npm/v/@libria/scaffold-core)
![License](https://img.shields.io/npm/l/@libria/scaffold-core)

## Installation

```bash
npm install @libria/scaffold-core
```

## API

### Types

**`ScaffoldTemplatePlugin<TOpt>`** — Interface that every template plugin must implement:

```typescript
interface ScaffoldTemplatePlugin<TOpt extends object = object> {
    readonly argument: string;
    getOptions(options: ScaffoldTemplatePluginOptions & Partial<ResolvedOptions<TOpt>>): Promise<Partial<{ [k in keyof TOpt]: ScaffoldTemplatePluginOption }>>;
    execute(options: ExecuteOptions<TOpt>): Promise<void>;
}
```

**`ScaffoldTemplatePluginOption<TValue>`** — Defines a single CLI option for a template:

```typescript
type ScaffoldTemplatePluginOption<TValue = string | boolean | number> = {
    readonly flags: string;
    readonly required?: boolean;
    readonly description: string;
    readonly defaultValue?: TValue | TValue[];
    readonly choices?: TValue[];
};
```

**`ScaffoldTemplatePluginOptions`** — Base options passed to every template:

```typescript
type ScaffoldTemplatePluginOptions = {
    name: string;
    dryRun?: boolean;
    force?: boolean;
};
```

**`SCAFFOLD_TEMPLATE_PLUGIN_TYPE`** — Plugin type constant (`"scaffold-template"`).

### Utilities

**`replacePlaceholders(targetDir, replacements)`** — Recursively walks a directory and replaces all occurrences of placeholder strings in `.ts`, `.js`, `.json`, `.md`, and `.txt` files.

```typescript
await replacePlaceholders('./my-project', {
    '{PACKAGE_NAME}': 'my-lib',
    '{DESCRIPTION}': 'A cool library',
});
```

## License

MIT
