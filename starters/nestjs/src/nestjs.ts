import {execSync} from 'child_process';
import {definePlugin, PluginContext} from '@libria/plugin-loader';
import {ScaffoldTemplatePlugin, ScaffoldTemplatePluginOption, ExecuteOptions, SCAFFOLD_TEMPLATE_PLUGIN_TYPE} from '@libria/scaffold-core';

export interface NestJSOptions {
    version: ScaffoldTemplatePluginOption<'string'>;
    language: ScaffoldTemplatePluginOption<'string'>;
    packageManager: ScaffoldTemplatePluginOption<'string'>;
    strict: ScaffoldTemplatePluginOption<'boolean'>;
}

export default definePlugin<ScaffoldTemplatePlugin<NestJSOptions>>({
    id: 'libria:scaffold:nestjs',
    name: 'nestjs',
    pluginType: SCAFFOLD_TEMPLATE_PLUGIN_TYPE,

    async create(_: PluginContext) {
        return {
            api: {
                argument: 'nestjs',
                getOptions: async (options) => {
                    if (!options.version) {
                        return {
                            version: {
                                type: 'string',
                                flags: '--version <version>',
                                description: 'NestJS version:',
                                choices: ['11', '10'],
                                defaultValue: '11',
                            },
                        };
                    }

                    const major = Number(options.version);
                    const allOptions: Record<string, ScaffoldTemplatePluginOption> = {
                        version: {
                            type: 'string',
                            flags: '--version <version>',
                            description: 'NestJS version:',
                            choices: ['11', '10'],
                            defaultValue: '11',
                        },
                        language: {
                            type: 'string',
                            flags: '--language <value>',
                            description: 'Which programming language?',
                        },
                        packageManager: {
                            type: 'string',
                            flags: '--package-manager <value>',
                            description: 'Which package manager would you like to use?',
                        },
                        strict: {
                            type: 'boolean',
                            flags: '--strict',
                            description: 'Enable TypeScript strict mode?',
                            defaultValue: false,
                        },
                    };

                    return allOptions;
                },
                execute: async (options: ExecuteOptions<NestJSOptions>) => {
                    const {name, dryRun} = options;
                    const major = Number(options.version);
                    const args: string[] = [];

                    if (options.language) args.push(`--language=${options.language}`);
                    if (options.packageManager) args.push(`--package-manager=${options.packageManager}`);
                    args.push(options.strict ? '--strict' : '--strict=false');

                    const cmd = `npx @nestjs/cli@${options.version} new ${name} ${args.join(' ')}`;

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
