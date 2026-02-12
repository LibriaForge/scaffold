import { defineConfig } from 'tsdown';

export default defineConfig([{
        outDir: './dist/cli',
        entry: { cli: 'src/cli.ts' },
        format: ['esm'],
        dts: true,
        sourcemap: true,
        minify: true,
    }
]);
