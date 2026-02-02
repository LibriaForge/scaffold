import { defineConfig } from 'tsdown';

export default defineConfig([
    {
        outDir: './dist/templates/ts-lib',
        entry: 'templates/ts-lib/index.ts',
        format: ['cjs', 'esm'],
        tsconfig: 'templates/tsconfig.templates.json',
        dts: true,
        sourcemap: true,
        minify: true,
        clean: true,
        copy: [
            { from: 'templates/ts-lib/files', to: 'dist/templates/ts-lib' },
            { from: 'templates/ts-lib/plugin.json', to: 'dist/templates/ts-lib' },
        ]
    },
]);
