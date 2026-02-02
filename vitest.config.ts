import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.tmp/**',
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
        },
    },
});
