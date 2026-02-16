import { execSync } from 'child_process';

import { definePlugin, PluginContext } from '@libria/plugin-loader';
import {
    ScaffoldTemplatePlugin,
    ScaffoldTemplatePluginOption,
    ExecuteOptions,
    SCAFFOLD_TEMPLATE_PLUGIN_TYPE,
    OptionTypeMap,
} from '@libria/scaffold-core';

export interface NextJSOptions {
    version: ScaffoldTemplatePluginOption<'string'>;
    language: ScaffoldTemplatePluginOption<'string'>;
    tailwind: ScaffoldTemplatePluginOption<'boolean'>;
    reactCompiler: ScaffoldTemplatePluginOption<'boolean'>;
    linter: ScaffoldTemplatePluginOption<'string'>;
    projectType: ScaffoldTemplatePluginOption<'string'>;
    srcDir: ScaffoldTemplatePluginOption<'boolean'>;
    bundler: ScaffoldTemplatePluginOption<'string'>;
    importAlias: ScaffoldTemplatePluginOption<'string'>;
    packageManager: ScaffoldTemplatePluginOption<'string'>;
    example: ScaffoldTemplatePluginOption<'string'>;
    examplePath: ScaffoldTemplatePluginOption<'string'>;
    install: ScaffoldTemplatePluginOption<'boolean'>;
    gitInit: ScaffoldTemplatePluginOption<'boolean'>;
}

export default definePlugin<ScaffoldTemplatePlugin<NextJSOptions>>({
    id: 'libria:scaffold:nextjs',
    name: 'nextjs',
    pluginType: SCAFFOLD_TEMPLATE_PLUGIN_TYPE,

    async create(_: PluginContext) {
        return {
            api: {
                argument: 'nextjs',
                getOptions: async options => {
                    return {
                        version: {
                            type: 'string',
                            flags: '--version <version>',
                            description: 'NextJS version:',
                            defaultValue: '@latest',
                        },
                        language: {
                            type: 'string',
                            flags: '--language <value>',
                            description: 'Which programming language?',
                            choices: ['typescript', 'javascript'],
                            defaultValue: 'typescript',
                        },
                        tailwind: {
                            type: 'boolean',
                            flags: '--tailwind',
                            description: 'Enable Tailwind CSS?',
                            defaultValue: true,
                        },
                        reactCompiler: {
                            type: 'boolean',
                            flags: '--react-compiler',
                            description: 'Enable React compiler?',
                            defaultValue: false,
                        },
                        linter: {
                            type: 'string',
                            flags: '--linter <value>',
                            description: 'Which linter would you like to use?',
                            choices: ['eslint', 'biome', 'none'],
                            defaultValue: 'eslint',
                        },
                        projectType: {
                            type: 'string',
                            flags: '--project-type <value>',
                            description: 'What type of project do you want to create?',
                            choices: ['app', 'api', 'empty'],
                            default: 'app'
                        },
                        srcDir: {
                            type: 'boolean',
                            flags: '--src-dir',
                            description: 'initialize in a src/ directory?',
                        },
                        bundler: {
                            type: 'string',
                            flags: '--bundler <value>',
                            description: 'Which bundler would you like to use?',
                            choices: ['turbopack', 'webpack'],
                            defaultValue: 'turbopack',
                        },
                        importAlias: {
                            type: 'string',
                            flags: '--import-alias <value>',
                            description: 'Which import alias would you like to use?',
                            defaultValue: '@/*',
                        },
                        packageManager: {
                            type: 'string',
                            flags: '--package-manager <value>',
                            description: 'Which package manager would you like to use?',
                            choices: ['npm', 'yarn', 'pnpm', 'bun'],
                            defaultValue: 'npm',
                        },
                        example: {
                            type: 'string',
                            flags: '--example [value]',
                            description: 'An example to bootstrap the app with',
                            required: false
                        },
                        examplePath: {
                            type: 'string',
                            flags: '--example-path [value]',
                            description: 'Specify the path to the example separately',
                            required: false
                        },
                        install: {
                            type: 'boolean',
                            flags: '--install',
                            description: 'Install dependencies after creating the project',
                            defaultValue: true
                        },
                        gitInit: {
                            type: 'boolean',
                            flags: '--git-init',
                            description: 'Initialize a git repository',
                            defaultValue: true
                        }
                    };
                },
                execute: async (options: ExecuteOptions<NextJSOptions>) => {
                    const { name, dryRun, version } = options;
                    const args: string[] = [];

                    // Language: --ts (default) or --js
                    if (options.language === 'javascript') {
                        args.push('--js');
                    } else {
                        args.push('--ts');
                    }

                    // Tailwind CSS: --tailwind (default)
                    if (options.tailwind) {
                        args.push('--tailwind');
                    }

                    // React Compiler: --react-compiler
                    if (options.reactCompiler) {
                        args.push('--react-compiler');
                    }

                    // Linter: --eslint, --biome, or --no-linter
                    switch (options.linter) {
                        case 'eslint':
                            args.push('--eslint');
                            break;
                        case 'biome':
                            args.push('--biome');
                            break;
                        case 'none':
                            args.push('--no-linter');
                            break;
                    }

                    // Project type: --app, --api, or --empty
                    switch (options.projectType) {
                        case 'app':
                            args.push('--app');
                            break;
                        case 'api':
                            args.push('--api');
                            break;
                        case 'empty':
                            args.push('--empty');
                            break;
                    }

                    // Src directory: --src-dir
                    if (options.srcDir) {
                        args.push('--src-dir');
                    }

                    // Bundler: --turbopack (default) or --webpack
                    switch (options.bundler) {
                        case 'webpack':
                            args.push('--webpack');
                            break;
                        case 'turbopack':
                            args.push('--turbopack');
                            break;
                    }

                    // Import alias: --import-alias <alias>
                    if (options.importAlias && options.importAlias !== '@/*') {
                        args.push(`--import-alias=${options.importAlias}`);
                    }

                    // Package manager: --use-npm, --use-pnpm, --use-yarn, or --use-bun
                    switch (options.packageManager) {
                        case 'npm':
                            args.push('--use-npm');
                            break;
                        case 'pnpm':
                            args.push('--use-pnpm');
                            break;
                        case 'yarn':
                            args.push('--use-yarn');
                            break;
                        case 'bun':
                            args.push('--use-bun');
                            break;
                    }

                    // Example: -e <name|url> or --example <name|url>
                    if (options.example) {
                        args.push(`-e ${options.example}`);
                    }

                    // Example path: --example-path <path>
                    if (options.examplePath) {
                        args.push(`--example-path ${options.examplePath}`);
                    }

                    // Install: --skip-install (if false)
                    if (!options.install) {
                        args.push('--skip-install');
                    }

                    // Git init: --disable-git (if false)
                    if (!options.gitInit) {
                        args.push('--disable-git');
                    }

                    const cmd = `npx create-next-app@${options.version ?? '@latest'} ${name} ${args.join(' ')}`;

                    if (dryRun) {
                        console.log('[dry-run] Would run:', cmd);
                        return;
                    }

                    console.log('Running:', cmd);
                    execSync(cmd, { stdio: 'inherit' });
                },
            },
        };
    },
});