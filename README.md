# @libria/scaffold

Forge your next project with lightning-fast scaffolding. A pluggable CLI that transforms blank directories into production-ready codebases in seconds.

![Version](https://img.shields.io/npm/v/@libria/scaffold)
![License](https://img.shields.io/npm/l/@libria/scaffold)

## ✨ Features

- **Interactive CLI**: Guided project creation with sensible defaults
- **Plugin System**: Extensible architecture for custom templates
- **Configuration File**: Register custom plugin directories via `.lbscaffold`
- **Dry Run Mode**: Preview what will be generated before committing
- **Force Overwrite**: Safely regenerate existing projects
- **Built-in Templates**: TypeScript libraries and more included

## Installation

```bash
npm install -g @libria/scaffold
```

Or use with npx:

```bash
npx lb-scaffold create
```

## CLI Usage

### Quick Start

Create a new project interactively:

```bash
lb-scaffold create
```

You'll be prompted for:
- Template choice (e.g., `ts-lib`)
- Project name
- Additional template-specific options
- Whether to initialize git and install dependencies

### Non-Interactive Mode

Pass all options up-front for CI/CD or scripting:

```bash
lb-scaffold create -t ts-lib -n my-awesome-lib --dry-run
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --template <name>` | Template to use | (prompted) |
| `-n, --name <project-name>` | Name of the new project folder | (prompted, required) |
| `--dry-run` | Show what would be generated without writing files | `false` |
| `--force` | Overwrite existing project folder if it exists | `false` |
| `-i, --interactive` | Run in interactive mode | `true` |

### Examples

Create a TypeScript library:

```bash
lb-scaffold create -t ts-lib -n my-utils
```

Preview generation without files:

```bash
lb-scaffold create -t ts-lib -n my-utils --dry-run
```

Force overwrite an existing project:

```bash
lb-scaffold create -t ts-lib -n my-utils --force
```

## Included Templates

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

- Angular versions: Latest, 20, 19, 18, 17, 16
- Stylesheet formats: SCSS, CSS, Sass, Less
- Optional routing module
- Optional Server-Side Rendering (SSR)
- Git initialization (optional)
- Dependency installation (optional)

```bash
lb-scaffold create -t angular -n my-angular-app
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
lb-scaffold create -t nestjs -n my-nest-api
```

**Interactive prompts:**
- Package manager selection (npm, Yarn, pnpm)
- Enable strict TypeScript mode?
- Skip git initialization?
- Skip package installation?


## Configuration

The scaffold CLI supports a configuration file (`.lbscaffold`) that allows you to register custom plugin directories. This enables you to use your own templates alongside the built-in ones.

### Config File Location

The CLI searches for `.lbscaffold` starting from the current directory and walking up the directory tree. This allows you to have project-specific or workspace-level configurations.

### Config Commands

Initialize a new config file:

```bash
lb-scaffold config init
```

This creates a `.lbscaffold` file with a default plugin path:

```json
{
  "plugins": ["./plugins/**"]
}
```

Add a custom plugin directory:

```bash
lb-scaffold config add ./my-templates/**
```

Remove a plugin directory:

```bash
lb-scaffold config remove ./my-templates/**
```

List all configured plugin patterns:

```bash
lb-scaffold config list
```

Show the full config file:

```bash
lb-scaffold config show
```

### Config File Format

The `.lbscaffold` config file is a JSON file with the following structure:

```json
{
  "plugins": [
    "./plugins/**",
    "./custom-templates/**",
    "/absolute/path/to/plugins/**"
  ]
}
```

The `plugins` array contains glob patterns pointing to directories containing template plugins. Paths can be:
- **Relative**: Resolved relative to the config file location
- **Absolute**: Used as-is

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
   lb-scaffold create
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
import { ScaffoldTemplatePluginOptions } from "@libria/scaffold";

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
import { input, confirm } from '@inquirer/prompts';
import { definePlugin } from '@libria/plugin-loader';
import { SCAFFOLD_TEMPLATE_PLUGIN_TYPE, ScaffoldTemplatePlugin } from '@libria/scaffold';
import { MyTemplateOptions } from './types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES_DIR = path.resolve(__dirname, 'files');

export default definePlugin<ScaffoldTemplatePlugin>(
    SCAFFOLD_TEMPLATE_PLUGIN_TYPE,
    'my-template',
    {
        argument: 'my-template',
        async execute(options: ScaffoldTemplatePluginOptions): Promise<void> {
            // Collect user input
            const userOptions = await getInitialOptions(options);
            // Generate the project
            await generateProject(userOptions);
            // Post-processing
            await postProcess(userOptions);
        }
    }
);

async function getInitialOptions(
    options: ScaffoldTemplatePluginOptions
): Promise<MyTemplateOptions> {
    const packageName = await input({
        message: 'Package name:',
        default: options.name,
    });

    const description = await input({
        message: 'Description:',
    });

    const framework = await input({
        message: 'Framework (react/vue/svelte):',
        default: 'react',
    });

    return { packageName, description, framework, ...options };
}

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

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Build templates
npm run build:templates

# Run tests
npm test

# Lint and format
npm run clean
```

## License

MIT - see LICENSE file for details