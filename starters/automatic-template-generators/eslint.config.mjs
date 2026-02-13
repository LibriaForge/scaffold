import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import unusedImports from 'eslint-plugin-unused-imports';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    prettierConfig,
    {
        files: ['src/**/*.ts', 'src/**/*.tsx'], // Only lint src folder
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            import: importPlugin,
            prettier: prettierPlugin,
            'unused-imports': unusedImports,
        },
        rules: {
            // Prettier integration
            'prettier/prettier': 'error',

            // Unused variables and imports
            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': [
                'warn',
                {
                    vars: 'all',
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],

            // Explicit member accessibility (public, private, protected)
            '@typescript-eslint/explicit-member-accessibility': [
                'error',
                {
                    accessibility: 'explicit',
                    overrides: {
                        constructors: 'off', // constructors default to public, no need to specify
                    },
                },
            ],

            // Explicit function return types
            '@typescript-eslint/explicit-function-return-type': [
                'warn',
                {
                    allowExpressions: true,
                    allowTypedFunctionExpressions: true,
                },
            ],

            // Sort imports alphabetically
            'import/order': [
                'error',
                {
                    groups: [
                        'builtin', // Node.js built-in modules
                        'external', // npm packages
                        'internal', // Your own modules
                        'parent', // Parent directories
                        'sibling', // Same directory
                        'index', // Index files
                    ],
                    'newlines-between': 'always',
                    alphabetize: {
                        order: 'asc',
                        caseInsensitive: true,
                    },
                },
            ],

            // No unused imports
            'no-unused-vars': 'off', // Turn off base rule (using TS version)
            // 'import/no-unused-modules': ['warn', { unusedExports: true }],

            // Additional helpful rules
            'no-console': ['warn', { allow: ['log', 'warn', 'error'] }],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'warn',
            'prefer-const': 'error',
            'no-var': 'error',
        },
    },
    {
        // Ignore patterns (replaces .eslintignore)
        ignores: ['node_modules/**', 'dist/**', 'build/**', '*.config.js', 'coverage/**', 'scripts/**', '.tmp/**', './tmp-clean-publish/**'],
    }
);
