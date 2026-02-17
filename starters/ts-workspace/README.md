# @libria/scaffold-plugin-ts-workspace

TypeScript workspace (monorepo) template for [@libria/scaffold](https://github.com/LibriaForge/scaffold).

This plugin manages TypeScript monorepo workspaces with npm workspaces and TypeScript project references. It provides two subcommands: `init` to create a new workspace, and `add` to add projects into an existing workspace.

## Installation

```bash
npm install @libria/scaffold-plugin-ts-workspace
```

## Usage

### Initialize a new workspace

```bash
# Interactive — prompts for all options
lb-scaffold new ts-workspace my-monorepo

# Non-interactive
lb-scaffold new ts-workspace my-monorepo --package-manager npm --git-init
```

### Add a project to an existing workspace

```bash
# Interactive — prompts for template and options
lb-scaffold new ts-workspace my-project --workspace ./my-monorepo --template ts-lib

# Add an Angular app
lb-scaffold new ts-workspace my-app --workspace ./my-monorepo --template angular

# Add a NestJS backend
lb-scaffold new ts-workspace my-api --workspace ./my-monorepo --template nestjs
```

## Supported Options

### `init` subcommand

| Option | Type | Description |
|--------|------|-------------|
| `--package-manager` | select | Package manager (npm, yarn, pnpm) |
| `--git-init` | boolean | Initialize a git repository |

### `add` subcommand

| Option | Type | Description |
|--------|------|-------------|
| `--workspace` | string | Path to the workspace root |
| `--template` | select | Template to use (ts-lib, angular, nestjs, nextjs) |
| `--base-path` | string | Subdirectory for the new project (e.g. `packages`) |

## How It Works

The `init` subcommand creates a workspace directory with a root `package.json` (configured for npm workspaces), a shared `tsconfig.base.json`, and a root `tsconfig.json` with project references.

The `add` subcommand delegates to other template plugins (ts-lib, angular, nestjs, nextjs) to scaffold the project, then automatically:
- Adds the project to the workspace's `package.json` workspaces array
- Adds a TypeScript project reference to the root `tsconfig.json`
- Patches the project's `tsconfig.json` to extend from the workspace's `tsconfig.base.json`

## License

MIT
