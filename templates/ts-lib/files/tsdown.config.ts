import { defineConfig } from 'tsdown';

export default defineConfig([
    {
        entry: { index: 'src/index.ts' },
        format: ['cjs', 'esm'],
        dts: true,
        sourcemap: true,
        clean: true,
        minify: true,
    },
    {
        entry: { cli: 'src/cli.ts' },
        format: ['cjs', 'esm'],
        dts: true,
        sourcemap: true,
        minify: true,
    },
]);
