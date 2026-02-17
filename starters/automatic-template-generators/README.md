# automatic-template-generators

Internal tool that auto-generates CLI wrapper template plugins for [@libria/scaffold](https://github.com/LibriaForge/scaffold).

This package reads CLI option schemas from tools like Angular CLI, NestJS CLI, and Next.js CLI, then generates the corresponding scaffold plugin source code with all options, types, and version mappings.

## Usage

This is an internal development tool, not published to npm.

```bash
# Generate all template wrappers
npm run build-and-generate-all

# Generate individual wrappers
npm run generate:angular
npm run generate:nestjs
npm run generate:nextjs
```

## How It Works

Each generator:
1. Reads the target CLI's option schema (JSON schemas, help output, etc.)
2. Maps options across supported major versions
3. Generates TypeScript source files with typed options, version-specific defaults, and CLI flag translation
4. Outputs the generated code into the corresponding starter plugin's `src/` directory

## License

MIT
