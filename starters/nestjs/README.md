# @libria/scaffold-plugin-nestjs

NestJS CLI wrapper template for [@libria/scaffold](https://github.com/LibriaForge/scaffold).

This plugin scaffolds new NestJS projects by wrapping `@nestjs/cli`, exposing its options through the scaffold plugin interface. Options are dynamically resolved based on the selected NestJS version.

## Installation

```bash
npm install @libria/scaffold-plugin-nestjs
```

## Usage

```bash
# Interactive — prompts for version first, then version-specific options
lb-scaffold new nestjs my-api

# Non-interactive — pass all options via CLI
lb-scaffold new nestjs my-api --version 11 --language TypeScript --package-manager pnpm

# Show available options for a specific version
lb-scaffold new nestjs my-api --version 10 --help
```

## Supported Options

| Option | Type | Description |
|--------|------|-------------|
| `--version` | select | NestJS major version (e.g. 11, 10) |
| `--language` | select | Programming language (TypeScript, JavaScript) |
| `--package-manager` | select | Package manager (npm, yarn, pnpm) |
| `--strict` | boolean | Enable TypeScript strict mode |
| `--skip-git` | boolean | Skip git initialization |
| `--skip-install` | boolean | Skip installing dependencies |

## How It Works

The plugin wraps `npx @nestjs/cli@<version> new <name>` and translates scaffold options into NestJS CLI flags. The option set is auto-generated from NestJS's JSON schemas across the last 2 major versions.

## License

MIT
