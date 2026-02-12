import { defineConfig } from 'tsdown';

const isDebug = process.env.NODE_ENV !== 'production';

export default defineConfig({
    entry: { index: 'src/index.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    minify: !isDebug,
});
