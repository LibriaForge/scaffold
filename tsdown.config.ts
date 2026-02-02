import { defineConfig } from 'tsdown';

export default defineConfig([
    {
        outDir: './dist/cli',
        entry: { index: 'src/index.ts' },
        format: ['cjs', 'esm'],
        dts: true,
        sourcemap: true,
        clean: true,
        minify: true,
    },
    {
        outDir: './dist/cli',
        entry: { cli: 'src/cli.ts' },
        format: ['esm'],
        dts: true,
        sourcemap: true,
        minify: true,
    }
]);
