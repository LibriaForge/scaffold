# @libria/scaffold-plugin-nextjs

Scaffold template for NextJS

## Installation

```bash
npm install @libria/scaffold-plugin-nextjs
```

## Usage

```typescript
import { add, subtract, multiply, divide } from '@libria/scaffold-plugin-nextjs';

console.log(add(2, 3));      // 5
console.log(subtract(5, 3)); // 2
console.log(multiply(4, 5)); // 20
console.log(divide(10, 2));  // 5
```

## API

### `add(a: number, b: number): number`

Adds two numbers together.

### `subtract(a: number, b: number): number`

Subtracts the second number from the first.

### `multiply(a: number, b: number): number`

Multiplies two numbers together.

### `divide(a: number, b: number): number`

Divides the first number by the second. Throws an error if the divisor is zero.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Lint
npm run lint
```

## License

MIT
