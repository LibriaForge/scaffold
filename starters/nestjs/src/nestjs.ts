import {execSync} from 'child_process';
import {definePlugin, PluginContext} from '@libria/plugin-loader';
import type {ScaffoldTemplatePlugin, ScaffoldTemplatePluginOption, ExecuteOptions} from '@libria/scaffold-core';

export interface NestJSOptions {
    version: ScaffoldTemplatePluginOption<string>;
}

export const SCAFFOLD_TEMPLATE_PLUGIN_TYPE = 'scaffold-template';

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
                            flags: '--version <version>',
                            description: 'NestJS version:',
                            choices: ['11', '10'],
                            defaultValue: '11',
                        },
                    };

                    return allOptions;
                },
                execute: async (options: ExecuteOptions<NestJSOptions>) => {
                    const {name, dryRun} = options;
                    const major = Number(options.version);
                    const args: string[] = [];


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
