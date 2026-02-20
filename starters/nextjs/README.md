# @libria/scaffold-plugin-nextjs

Next.js CLI wrapper template for [@libria/scaffold](https://github.com/LibriaForge/scaffold).

This plugin scaffolds new Next.js projects by wrapping `create-next-app`, exposing its options through the scaffold plugin interface.

## Installation

```bash
npm install @libria/scaffold-plugin-nextjs
```

## Usage

```bash
# Interactive — prompts for all options
lb-scaffold new nextjs my-app

# Non-interactive — pass all options via CLI
lb-scaffold new nextjs my-app --language typescript --tailwind --bundler turbopack

# Show available options
lb-scaffold new nextjs my-app --help
```

## Supported Options

| Option | Type | Description |
|--------|------|-------------|
| `--version` | string | Next.js version (default: latest) |
| `--language` | select | Language (typescript, javascript) |
| `--tailwind` | boolean | Enable Tailwind CSS (default: true) |
| `--react-compiler` | boolean | Enable React compiler (default: false) |
| `--linter` | select | Linter (eslint, biome, none) |
| `--project-type` | select | Project type (app, api, empty) |
| `--src-dir` | boolean | Initialize with src/ directory |
| `--bundler` | select | Bundler (turbopack, webpack) |
| `--import-alias` | string | Import alias pattern (default: @/*) |
| `--package-manager` | select | Package manager (npm, yarn, pnpm, bun) |
| `--install` | boolean | Install dependencies (default: true) |
| `--git-init` | boolean | Initialize git repository (default: true) |

## How It Works

The plugin wraps `npx create-next-app@<version> <name>` and translates scaffold options into Next.js CLI flags.

## License

MIT
