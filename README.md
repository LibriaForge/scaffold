# LibriaForge Scaffold

Monorepo for `@libria/scaffold` — a pluggable CLI that transforms blank directories into production-ready codebases in seconds.

## Packages

| Package | Description |
|---------|-------------|
| [`@libria/scaffold`](./cli) | CLI tool for scaffolding projects |
| [`@libria/scaffold-core`](./core) | Shared types and utilities for scaffold plugins |

## Development

```bash
# Install all dependencies (workspaces are linked automatically)
npm install

# Build all packages (core first, then cli)
npm run build

# Run all tests
npm run test

# Lint and format
npm run clean
```

## Version Management

All packages are versioned in lockstep. Bump all versions and update cross-workspace dependency references with a single command:

```bash
npm run bump patch   # 0.3.0 -> 0.3.1
npm run bump minor   # 0.3.0 -> 0.4.0
npm run bump major   # 0.3.0 -> 1.0.0
```

## Publishing

Publish packages in dependency order:

1. `cd core && npm run build-and-publish`
2. `cd cli && npm run build-and-publish`

## License

MIT
