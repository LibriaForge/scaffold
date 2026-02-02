# @libria/ts-barrels

A simple, fast TypeScript barrel file generator that recursively creates `index.ts` exports for your project.

## What are Barrel Files?

Barrel files (typically `index.ts`) re-export modules from a directory, enabling cleaner imports:

```typescript
// Without barrels
import { UserService } from './services/user/UserService';
import { AuthService } from './services/auth/AuthService';

// With barrels
import { UserService, AuthService } from './services';
```

## Installation

```bash
npm install @libria/ts-barrels
```

## CLI Usage

```bash
npx ts-barrels <root> [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `<root>` | Root folder to generate barrels in | (required) |
| `--all` | Generate barrels recursively from leaves to root | `false` |
| `--force` | Overwrite existing barrel files | `false` |
| `--name <filename>` | Custom barrel filename | `index.ts` |

### Examples

Generate barrels for the entire `src` directory:

```bash
npx ts-barrels src --all
```

Generate with a custom filename:

```bash
npx ts-barrels src --all --name barrel.ts
```

Force regenerate all barrels:

```bash
npx ts-barrels src --all --force
```

## Programmatic Usage

```typescript
import { generateBarrels } from '@libria/ts-barrels';

await generateBarrels('./src', {
  all: true,
  force: false,
  filename: 'index.ts'
});
```

## Skip Comment

To prevent a barrel file from being overwritten, add a skip comment at the top:

```typescript
// @libria/ts-barrels skip
export * from './custom-export';
export { specific } from './module';
```

Files with the skip comment are **always preserved**, even when using `--force`.

## Generated Output

Given this structure:

```
src/
  features/
    auth/
      login.ts
      logout.ts
    users/
      create.ts
      delete.ts
  utils/
    helpers.ts
```

Running `npx ts-barrels src --all` generates:

```
src/
  index.ts          -> export * from './features'; export * from './utils';
  features/
    index.ts        -> export * from './auth'; export * from './users';
    auth/
      index.ts      -> export * from './login'; export * from './logout';
    users/
      index.ts      -> export * from './create'; export * from './delete';
  utils/
    index.ts        -> export * from './helpers';
```

## License

MIT
