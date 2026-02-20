# @libria/scaffold

Forge your next project with lightning-fast scaffolding. A pluggable CLI that transforms blank directories into production-ready codebases in seconds.

![Version](https://img.shields.io/npm/v/@libria/scaffold)
![License](https://img.shields.io/npm/l/@libria/scaffold)

## ✨ Features

- **Interactive CLI**: Guided project creation with sensible defaults
- **Plugin System**: Extensible architecture for custom templates
- **Configuration File**: Register custom plugin directories and npm packages via `.lbscaffold.json`
- **NPM Package Support**: Load templates from npm packages
- **Dry Run Mode**: Preview what will be generated before committing
- **Force Overwrite**: Safely regenerate existing projects
- **Global + Local Config**: Global `~/.lbscaffold.json` defaults with local per-key overrides
- **Template Plugins**: Angular, NestJS, Next.js, TypeScript libraries, and workspaces

## Installation

```bash
npm install -g @libria/scaffold
```

Or use with npx:

```bash
npx lb-scaffold new
```

## CLI Usage

### Quick Start

Create a new project interactively:

```bash
lb-scaffold new
```

You'll be prompted to select a template, and then enter:
- Project name (required)
- Additional template-specific options (e.g., framework version, styles format)
- Whether to skip git initialization (if supported)

### Non-Interactive Mode

Pass all options up-front for CI/CD or scripting:

```bash
lb-scaffold new ts-lib my-awesome-lib --dry-run
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `<name>` | Name of the new project folder | (required) |
| `--dry-run` | Show what would be generated without writing files | `false` |
| `--force` | Overwrite existing project folder if it exists | `false` |

Template-specific options are available per template and will be shown in `--help`.

### Examples

Create a TypeScript library:

```bash
lb-scaffold new ts-lib my-utils
```

Preview generation without files:

```bash
lb-scaffold new ts-lib my-utils --dry-run
```

Force overwrite an existing project:

```bash
lb-scaffold new ts-lib my-utils --force
```

Create a new Angular application with specific options:

```bash
lb-scaffold new angular my-app --version 20 --style scss --routing --ssr
```

## Optional Templates

### ts-lib

A modern TypeScript library template with:

- ESLint + Prettier configuration
- Vitest for testing
- tsdown for fast builds
- TypeScript path aliases
- Package.json with proper exports
- Comprehensive README and LICENSE

### angular

A complete Angular application template using the official Angular CLI. Supports:

- Angular versions: Latest, 21, 20, 19, 18, 17, 16
- Stylesheet formats: SCSS, CSS, Sass, Less
- Optional routing module
- Optional Server-Side Rendering (SSR)
- Git initialization (optional)
- Dependency installation (optional)

```bash
lb-scaffold new angular my-angular-app
```

**Interactive prompts:**
- Angular version selection
- Stylesheet format (SCSS recommended)
- Add routing module?
- Enable SSR?
- Skip git initialization?
- Skip npm install?

### nestjs

A production-ready NestJS backend application using the official NestJS CLI. Includes:

- TypeScript with strict mode (optional)
- Package manager choice: npm, Yarn, or pnpm
- Controller, Service, and Module structure
- Unit test setup with Jest
- E2E test configuration
- Git initialization (optional)
- Dependency installation (optional)

```bash
lb-scaffold new nestjs my-nest-api
```

**Interactive prompts:**
- Package manager selection (npm, Yarn, pnpm)
- Enable strict TypeScript mode?
- Skip git initialization?
- Skip package installation?

### nextjs

A Next.js application template using the official `create-next-app`. Supports:

- Tailwind CSS (enabled by default)
- TypeScript or JavaScript
- App Router, API-only, or empty project types
- Turbopack or Webpack bundler
- ESLint, Biome, or no linter
- Package manager choice: npm, Yarn, pnpm, or Bun

```bash
lb-scaffold new nextjs my-next-app
```

**Interactive prompts:**
- Next.js version
- Language (TypeScript/JavaScript)
- Enable Tailwind CSS?
- Bundler (Turbopack/Webpack)
- Project type (app/api/empty)

### ts-workspace

A TypeScript workspace (monorepo) template using npm workspaces and TypeScript project references. Provides two subcommands:

- **`init`** — Create a new workspace with shared tsconfig, package.json workspaces, and git setup
- **`add`** — Add projects into an existing workspace using other templates (ts-lib, angular, nestjs, nextjs)

Automatically manages workspace `package.json` entries, TypeScript project references, and tsconfig inheritance.

```bash
# Create a new workspace
lb-scaffold new ts-workspace my-monorepo

# Add a project into the workspace
lb-scaffold new ts-workspace my-lib --workspace ./my-monorepo --template ts-lib
```

**Interactive prompts (init):**
- Package manager (npm, Yarn, pnpm)
- Initialize git repository?

**Interactive prompts (add):**
- Workspace root path
- Template to use
- Base path for the new project

## Configuration

The scaffold CLI supports a configuration file (`.lbscaffold.json`) that allows you to register custom plugin directories and npm packages. This enables you to use your own templates alongside the built-in ones.

### Config File Locations

The CLI supports two config file locations:

- **Global**: `~/.lbscaffold.json` — provides machine-wide defaults
- **Local**: `.lbscaffold.json` found by searching up from the current directory

When both exist, local keys override global keys on a per-key basis. For example, if the local config defines `plugins`, it fully replaces the global `plugins`; keys not present locally fall through to the global config.

### Config Commands

Initialize a new config file in the current directory:

```bash
lb-scaffold config init
```

Initialize the global config file:

```bash
lb-scaffold config init -g
```

This creates a `.lbscaffold.json` file with a default plugin path:

```json
{
  "plugins": ["./plugins/**"],
  "packages": []
}
```

Add a custom plugin directory:

```bash
lb-scaffold config add ./my-templates/**

# Add to global config
lb-scaffold config add ./my-templates/** -g
```

Remove a plugin directory:

```bash
lb-scaffold config remove ./my-templates/**
```

List all configured plugin patterns (shows merged config with source indicators):

```bash
lb-scaffold config list

# Show only global config
lb-scaffold config list -g
```

Show the full config file:

```bash
lb-scaffold config show

# Show only global config
lb-scaffold config show -g
```

All config subcommands accept `-g` / `--global` to target the global config (`~/.lbscaffold.json`) instead of the local one.

### Config File Format

The `.lbscaffold.json` config file is a JSON file with the following structure:

```json
{
  "plugins": [
    "./plugins/**",
    "./custom-templates/**",
    "/absolute/path/to/plugins/**"
  ],
  "packages": [
    "@libria/scaffold-plugin-angular",
    "@libria/scaffold-plugin-nestjs"
  ]
}
```

The `plugins` array contains glob patterns pointing to directories containing template plugins. Paths can be:
- **Relative**: Resolved relative to the config file location
- **Absolute**: Used as-is

The `packages` array contains npm package names that provide scaffold template plugins. These packages will be loaded via node_modules.

### Adding NPM Packages

Add an npm package as a plugin source:

```bash
lb-scaffold config add-package @your-org/scaffold-plugin-my-template
```

Remove an npm package:

```bash
lb-scaffold config remove-package @your-org/scaffold-plugin-my-template
```

List all configured npm packages:

```bash
lb-scaffold config list-packages
```

### Plugin Override Behavior

When a user plugin has the same name as a built-in plugin, the user plugin takes precedence. This allows you to customize or replace built-in templates.

### Example: Using Custom Templates

1. Create a config file:
   ```bash
   lb-scaffold config init
   ```

2. Add your custom templates directory:
   ```bash
   lb-scaffold config add ./my-company-templates/**
   ```

3. Create a template plugin in that directory (see [Creating Custom Template Plugins](#creating-custom-template-plugins))

4. Your template will now appear in the template selection:
   ```bash
   lb-scaffold new
   ```

## Creating Custom Template Plugins

The scaffold CLI uses a plugin system powered by `@libria/plugin-loader`. Each template is a self-contained plugin.

### Plugin Structure

```
templates/
└── my-template/
    ├── plugin.json          # Plugin metadata
    ├── index.ts             # Plugin entry point
    ├── types.ts             # TypeScript types
    ├── my-template.ts       # Implementation
    └── files/               # Template files
        ├── package.json
        ├── tsconfig.json
        └── src/
```

### Step 1: Create plugin.json

```json
{
    "name": "my-template",
    "version": "1.0.0",
    "type": "scaffold-template",
    "main": "./index.ts",
    "description": "My custom template"
}
```

### Step 2: Define Types (types.ts)

```typescript
import {
    ScaffoldTemplatePluginOptions,
    ScaffoldTemplatePluginOption,
} from "@libria/scaffold-core";

export type MyTemplateOptions = ScaffoldTemplatePluginOptions & {
    packageName: string;
    description: string;
    framework: 'react' | 'vue' | 'svelte';
};
```

### Step 3: Implement the Plugin (my-template.ts)

```typescript
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { definePlugin } from '@libria/plugin-loader';
import { SCAFFOLD_TEMPLATE_PLUGIN_TYPE, ScaffoldTemplatePlugin } from '@libria/scaffold-core';
import { MyTemplateOptions } from './types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES_DIR = path.resolve(__dirname, 'files');

export default definePlugin<ScaffoldTemplatePlugin>(
    SCAFFOLD_TEMPLATE_PLUGIN_TYPE,
    'my-template',
    {
        argument: 'my-template',
        async execute(options: ScaffoldTemplatePluginOptions): Promise<void> {
            // Collect user input (via getOptions - see ScaffoldTemplatePlugin)
            const userOptions = options as MyTemplateOptions;
            // Generate the project
            await generateProject(userOptions);
            // Post-processing
            await postProcess(userOptions);
        },
        async getOptions(options: ScaffoldTemplatePluginOptions): Promise<Record<string, ScaffoldTemplatePluginOption>> {
            return {
                packageName: {
                    flags: '-p, --package-name <name>',
                    description: 'Package name',
                    defaultValue: options.name,
                },
                description: {
                    flags: '-d, --description <text>',
                    description: 'Project description',
                },
                framework: {
                    flags: '-f, --framework <name>',
                    description: 'Framework',
                    defaultValue: 'react',
                    choices: ['react', 'vue', 'svelte'],
                },
            };
        },
    }
);

async function generateProject(options: MyTemplateOptions): Promise<void> {
    const { name, dryRun, force } = options;
    const targetDir = path.resolve(process.cwd(), name);

    // Handle existing directory
    if (await fs.pathExists(targetDir)) {
        if (!force) {
            console.error(`Directory '${name}' already exists. Use --force to overwrite.`);
            process.exit(1);
        }
        if (!dryRun) {
            await fs.remove(targetDir);
        }
    }

    // Create and copy files
    if (!dryRun) {
        await fs.ensureDir(targetDir);
        await fs.copy(FILES_DIR, targetDir);
        // Replace placeholders
        await replacePlaceholders(targetDir, options);
    }

    console.log(`Project '${name}' created successfully!`);
}

async function replacePlaceholders(
    targetDir: string,
    options: MyTemplateOptions
): Promise<void> {
    // Replace {PACKAGE_NAME}, {DESCRIPTION}, etc. in files
}

async function postProcess(options: MyTemplateOptions): Promise<void> {
    // Git init, npm install, etc.
}
```

### Step 4: Export the Plugin (index.ts)

```typescript
export { default } from './my-template';
export * from './types';
```

### Step 5: Create Template Files (files/)

Use placeholders that will be replaced:

`package.json`:
```json
{
    "name": "{PACKAGE_NAME}",
    "description": "{DESCRIPTION}",
    "version": "1.0.0"
}
```

### Step 6: Build the Templates

```bash
npm run build:templates
```

This compiles your template plugins to the `dist/templates` directory.

## Development

This package is part of the [LibriaForge Scaffold monorepo](../README.md). From the repo root:

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Run all tests
npm run test
```

Or work on the CLI package directly:

```bash
cd cli
npm run build
npm test
npm run clean
```

## License

MIT - see LICENSE file for details