# @libria/scaffold-plugin-angular

Angular CLI wrapper template for [@libria/scaffold](https://github.com/LibriaForge/scaffold).

This plugin scaffolds new Angular projects by wrapping `@angular/cli`, exposing its options through the scaffold plugin interface. Options are dynamically resolved based on the selected Angular version.

## Installation

```bash
npm install @libria/scaffold-plugin-angular
```

## Usage

```bash
# Interactive — prompts for version first, then version-specific options
lb-scaffold new angular my-app

# Non-interactive — pass all options via CLI
lb-scaffold new angular my-app --version 21 --style scss --routing --ssr

# Show available options for a specific version
lb-scaffold new angular my-app --version 18 --help
```

## Supported Options

Options vary by Angular version. Common options include:

| Option | Type | Description |
|--------|------|-------------|
| `--version` | select | Angular major version (e.g. 21, 20, 19, 18) |
| `--style` | select | Stylesheet format (css, scss, sass, less) |
| `--routing` | boolean | Add routing module |
| `--ssr` | boolean | Enable Server-Side Rendering |
| `--package-manager` | select | Package manager (npm, yarn, pnpm) |
| `--strict` | boolean | Enable strict mode |
| `--prefix` | string | Component selector prefix |
| `--skip-tests` | boolean | Skip generating test files |
| `--skip-git` | boolean | Skip git initialization |
| `--skip-install` | boolean | Skip installing dependencies |

## How It Works

The plugin wraps `npx @angular/cli@<version> new <name>` and translates scaffold options into Angular CLI flags. The option set is auto-generated from Angular's JSON schemas across multiple major versions.

## License

MIT
