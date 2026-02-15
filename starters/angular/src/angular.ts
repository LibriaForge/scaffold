import {execSync} from 'child_process';
import {definePlugin, PluginContext} from '@libria/plugin-loader';
import {ScaffoldTemplatePlugin, ScaffoldTemplatePluginOption, ExecuteOptions, SCAFFOLD_TEMPLATE_PLUGIN_TYPE} from '@libria/scaffold-core';

export interface AngularOptions {
    version: ScaffoldTemplatePluginOption<'string'>;
    style: ScaffoldTemplatePluginOption<'string'>;
    packageManager: ScaffoldTemplatePluginOption<'string'>;
    routing: ScaffoldTemplatePluginOption<'boolean'>;
    ssr: ScaffoldTemplatePluginOption<'boolean'>;
    standalone: ScaffoldTemplatePluginOption<'boolean'>;
    strict: ScaffoldTemplatePluginOption<'boolean'>;
    aiConfig: ScaffoldTemplatePluginOption<'string'>;
    fileNameStyleGuide: ScaffoldTemplatePluginOption<'string'>;
    prefix: ScaffoldTemplatePluginOption<'string'>;
    testRunner: ScaffoldTemplatePluginOption<'string'>;
    viewEncapsulation: ScaffoldTemplatePluginOption<'string'>;
    experimentalZoneless: ScaffoldTemplatePluginOption<'boolean'>;
    inlineStyle: ScaffoldTemplatePluginOption<'boolean'>;
    inlineTemplate: ScaffoldTemplatePluginOption<'boolean'>;
    minimal: ScaffoldTemplatePluginOption<'boolean'>;
    serverRouting: ScaffoldTemplatePluginOption<'boolean'>;
    skipGit: ScaffoldTemplatePluginOption<'boolean'>;
    skipInstall: ScaffoldTemplatePluginOption<'boolean'>;
    skipTests: ScaffoldTemplatePluginOption<'boolean'>;
    zoneless: ScaffoldTemplatePluginOption<'boolean'>;
}

const SUPPORTED_VERSIONS: Record<string, number[]> = {
    aiConfig: [21, 20],
    fileNameStyleGuide: [21],
    testRunner: [21],
    experimentalZoneless: [19],
    serverRouting: [19],
    zoneless: [21, 20],
};

export default definePlugin<ScaffoldTemplatePlugin<AngularOptions>>({
    id: 'libria:scaffold:angular',
    name: 'angular',
    pluginType: SCAFFOLD_TEMPLATE_PLUGIN_TYPE,

    async create(_: PluginContext) {
        return {
            api: {
                argument: 'angular',
                getOptions: async (options) => {
                    if (!options.version) {
                        return {
                            version: {
                                type: 'string',
                                flags: '--version <version>',
                                description: 'Angular version:',
                                choices: ['21', '20', '19', '18'],
                                defaultValue: '21',
                            },
                        };
                    }

                    const major = Number(options.version);
                    const allOptions: Record<string, ScaffoldTemplatePluginOption> = {
                        version: {
                            type: 'string',
                            flags: '--version <version>',
                            description: 'Angular version:',
                            choices: ['21', '20', '19', '18'],
                            defaultValue: '21',
                        },
                        style: {
                            type: 'string',
                            flags: '--style <value>',
                            description: 'Which stylesheet format would you like to use?',
                            choices: ['css', 'scss', 'sass', 'less', 'tailwind'],
                        },
                        packageManager: {
                            type: 'string',
                            flags: '--package-manager <value>',
                            description: 'Which package manager would you like to use?',
                            choices: ['npm', 'yarn', 'pnpm', 'bun', 'cnpm'],
                        },
                        routing: {
                            type: 'boolean',
                            flags: '--routing',
                            description: 'Add routing?',
                        },
                        ssr: {
                            type: 'boolean',
                            flags: '--ssr',
                            description: 'Enable Server-Side Rendering (SSR)?',
                        },
                        standalone: {
                            type: 'boolean',
                            flags: '--standalone',
                            description: 'Use standalone components?',
                            defaultValue: true,
                        },
                        strict: {
                            type: 'boolean',
                            flags: '--strict',
                            description: 'Enable strict mode?',
                            defaultValue: true,
                        },
                        aiConfig: {
                            type: 'array',
                            flags: '--ai-config <value>',
                            description: 'Specifies which AI tools to generate configuration files for. These file are used to improve the outputs of AI tools by following the best practices.',
                        },
                        fileNameStyleGuide: {
                            type: 'string',
                            flags: '--file-name-style-guide <value>',
                            description: 'The file naming convention to use for generated files. The \'2025\' style guide (default) uses a concise format (e.g., `app.ts` for the root component), while the \'2016\' style guide includes the type in the file name (e.g., `app.component.ts`). For more information, see the Angular Style Guide (https://angular.dev/style-guide).',
                            choices: ['2016', '2025'],
                            defaultValue: '2025',
                        },
                        prefix: {
                            type: 'string',
                            flags: '--prefix <value>',
                            description: 'Component selector prefix:',
                            defaultValue: 'app',
                        },
                        testRunner: {
                            type: 'string',
                            flags: '--test-runner <value>',
                            description: 'The unit testing runner to use.',
                            choices: ['vitest', 'karma'],
                            defaultValue: 'vitest',
                        },
                        viewEncapsulation: {
                            type: 'string',
                            flags: '--view-encapsulation <value>',
                            description: 'Which view encapsulation strategy?',
                            choices: ['Emulated', 'None', 'ShadowDom'],
                        },
                        experimentalZoneless: {
                            type: 'boolean',
                            flags: '--experimental-zoneless',
                            description: 'Create an initial application that does not utilize `zone.js`.',
                            defaultValue: false,
                        },
                        inlineStyle: {
                            type: 'boolean',
                            flags: '--inline-style',
                            description: 'Use inline styles?',
                        },
                        inlineTemplate: {
                            type: 'boolean',
                            flags: '--inline-template',
                            description: 'Use inline templates?',
                        },
                        minimal: {
                            type: 'boolean',
                            flags: '--minimal',
                            description: 'Create a minimal project?',
                            defaultValue: false,
                        },
                        serverRouting: {
                            type: 'boolean',
                            flags: '--server-routing',
                            description: 'Create a server application in the initial project using the Server Routing and App Engine APIs (Developer Preview).',
                        },
                        skipGit: {
                            type: 'boolean',
                            flags: '--skip-git',
                            description: 'Skip git initialization?',
                            defaultValue: false,
                        },
                        skipInstall: {
                            type: 'boolean',
                            flags: '--skip-install',
                            description: 'Skip installing dependencies?',
                            defaultValue: false,
                        },
                        skipTests: {
                            type: 'boolean',
                            flags: '--skip-tests',
                            description: 'Skip generating test files?',
                            defaultValue: false,
                        },
                        zoneless: {
                            type: 'boolean',
                            flags: '--zoneless',
                            description: 'Create an initial application that does not utilize `zone.js`.',
                        },
                    };

                    for (const [key, versions] of Object.entries(SUPPORTED_VERSIONS)) {
                        if (!versions.includes(major)) {
                            delete allOptions[key];
                        }
                    }

                    return allOptions;
                },
                execute: async (options: ExecuteOptions<AngularOptions>) => {
                    const {name, dryRun} = options;
                    const major = Number(options.version);
                    const args: string[] = [];

                    args.push(`--style=${options.style}`);
                    args.push(`--package-manager=${options.packageManager}`);
                    args.push(options.routing ? '--routing' : '--routing=false');
                    args.push(options.ssr ? '--ssr' : '--ssr=false');
                    args.push(options.standalone ? '--standalone' : '--standalone=false');
                    args.push(options.strict ? '--strict' : '--strict=false');
                    if (SUPPORTED_VERSIONS.aiConfig.includes(major)) {
                        if (options.aiConfig) args.push(`--ai-config=${options.aiConfig}`);
                    }
                    if (SUPPORTED_VERSIONS.fileNameStyleGuide.includes(major)) {
                        args.push(`--file-name-style-guide=${options.fileNameStyleGuide}`);
                    }
                    if (options.prefix) args.push(`--prefix=${options.prefix}`);
                    if (SUPPORTED_VERSIONS.testRunner.includes(major)) {
                        args.push(`--test-runner=${options.testRunner}`);
                    }
                    args.push(`--view-encapsulation=${options.viewEncapsulation}`);
                    if (SUPPORTED_VERSIONS.experimentalZoneless.includes(major)) {
                        args.push(options.experimentalZoneless ? '--experimental-zoneless' : '--experimental-zoneless=false');
                    }
                    if (options.inlineStyle) args.push('--inline-style');
                    if (options.inlineTemplate) args.push('--inline-template');
                    if (options.minimal) args.push('--minimal');
                    if (SUPPORTED_VERSIONS.serverRouting.includes(major)) {
                        args.push(options.serverRouting ? '--server-routing' : '--server-routing=false');
                    }
                    if (options.skipGit) args.push('--skip-git');
                    if (options.skipInstall) args.push('--skip-install');
                    if (options.skipTests) args.push('--skip-tests');
                    if (SUPPORTED_VERSIONS.zoneless.includes(major)) {
                        args.push(options.zoneless ? '--zoneless' : '--zoneless=false');
                    }

                    const cmd = `npx @angular/cli@${options.version} new ${name} ${args.join(' ')}`;

                    if (dryRun) {
                        console.log('[dry-run] Would run:', cmd);
                        return;
                    }

                    console.log('Running:', cmd);
                    execSync(cmd, {stdio: 'inherit'});
                },
            },
        };
    },
});
