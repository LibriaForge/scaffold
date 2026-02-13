import { definePlugin, PluginContext } from '@libria/plugin-loader';
import {
    ExecuteOptions,
    SCAFFOLD_TEMPLATE_PLUGIN_TYPE,
    ScaffoldTemplatePlugin,
    ScaffoldTemplatePluginOptions,
    SubcommandDefinition,
} from '@libria/scaffold-core';

import { addProject, initWorkspace, templateChoices } from './sub-commands';
import { AddOptions, InitOptions } from './types';

const subcommands: SubcommandDefinition[] = [
    { name: 'init', description: 'Initialize a new workspace' },
    { name: 'add', description: 'Add a package to the workspace' },
];

export default definePlugin<ScaffoldTemplatePlugin>({
    id: '@libria/scaffold-plugin-ts-workspace',
    name: 'ts-workspace',
    pluginType: SCAFFOLD_TEMPLATE_PLUGIN_TYPE,
    async create(ctx: PluginContext) {
        return {
            api: {
                argument: 'ts-workspace',
                subcommands,

                async getOptions(opts: ScaffoldTemplatePluginOptions) {
                    switch (opts.subcommand) {
                        case 'init':
                            return {
                                gitInit: {
                                    flags: '--git-init',
                                    description: 'Initialize git repository?',
                                    defaultValue: true,
                                },
                                packageManager: {
                                    flags: '--package-manager',
                                    description: 'Package Manager (npm/yarn/pnpm):',
                                    choices: ['npm', 'yarn', 'pnpm'],
                                    defaultValue: 'npm',
                                },
                            } satisfies InitOptions;
                        case 'add': {
                            const addBase: AddOptions = {
                                workspace: {
                                    flags: '--workspace <workspace>',
                                    description: 'Workspace to use:',
                                },
                                template: {
                                    flags: '--template <template>',
                                    description: 'Template to use:',
                                    choices: templateChoices,
                                },
                            };

                            // Once template is chosen, delegate to that plugin's getOptions
                            const templateKey = (opts as Record<string, unknown>).template as
                                | string
                                | undefined;
                            if (templateKey) {
                                const pluginId = templateChoices.includes(templateKey)
                                    ? `libria:scaffold:${templateKey}`
                                    : undefined;
                                if (pluginId && ctx.hasPlugin(pluginId)) {
                                    const templatePlugin =
                                        ctx.getPlugin<ScaffoldTemplatePlugin>(pluginId);
                                    const templateOpts = await templatePlugin.getOptions(opts);
                                    return { ...addBase, ...templateOpts };
                                }
                            }

                            return addBase;
                        }
                        default:
                            return {};
                    }
                },

                async execute(opts: ExecuteOptions<InitOptions | AddOptions>) {
                    switch (opts.subcommand) {
                        case 'init':
                            await initWorkspace(opts as ExecuteOptions<InitOptions>);
                            break;
                        case 'add':
                            await addProject(ctx, opts as ExecuteOptions<AddOptions>);
                            break;
                    }
                },
            },
        };
    },
});
