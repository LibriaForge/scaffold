import { defineConfig } from 'tsdown';
const isDebug = process.env.NODE_ENV !== 'production';

export default defineConfig([
    {
        outDir: './dist/generators/angular',
        entry: 'generators/angular/index.ts',
        format: ['cjs', 'esm'],
        tsconfig: 'generators/tsconfig.generators.json',
        dts: true,
        sourcemap: true,
        minify: !isDebug,
        clean: true,
        copy: [
            { from: 'generators/angular/plugin.json', to: 'dist/generators/angular' },
        ]
    },
    {
        outDir: './dist/generators/nestjs',
        entry: 'generators/nestjs/index.ts',
        format: ['cjs', 'esm'],
        tsconfig: 'generators/tsconfig.generators.json',
        dts: true,
        sourcemap: true,
        minify: !isDebug,
        clean: true,
        copy: [
            { from: 'generators/nestjs/plugin.json', to: 'dist/generators/nestjs' },
        ]
    }
]);
