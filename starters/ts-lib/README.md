# @libria/scaffold-plugin-ts-lib

TypeScript library template for [@libria/scaffold](https://github.com/LibriaForge/scaffold).

This plugin scaffolds new TypeScript library projects with a pre-configured build setup, testing, linting, and publishing workflow.

## Installation

```bash
npm install @libria/scaffold-plugin-ts-lib
```

## Usage

```bash
# Interactive — prompts for all options
lb-scaffold new ts-lib my-lib

# Non-interactive
lb-scaffold new ts-lib my-lib --author "John Doe" --license MIT
```

## What You Get

A ready-to-use TypeScript library project with:

- TypeScript configuration (strict mode)
- Build setup with dual CJS/ESM output
- Vitest for testing
- ESLint + Prettier for code quality
- Package.json with proper exports map

## License

MIT
