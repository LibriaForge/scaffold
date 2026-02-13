import { defineConfig } from 'tsdown';
const isDebug = process.env.NODE_ENV !== 'production';

export default defineConfig([{
        outDir: './dist/cli',
        entry: { cli: 'src/cli.ts' },
        format: ['esm'],
        dts: true,
        sourcemap: true,
        minify: !isDebug,
    }
]);