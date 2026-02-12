import path from 'path';

import { definePlugin, PluginContext } from '@libria/plugin-loader';
import {
    ExecuteOptions,
    SCAFFOLD_TEMPLATE_PLUGIN_TYPE,
    ScaffoldTemplatePlugin,
    ScaffoldTemplatePluginOptions,
    SubcommandDefinition,
} from '@libria/scaffold-core';
import fs from 'fs-extra';

import { AddOptions, InitOptions } from './types';
import { initWorkspace } from './sub-commands';

/**
 * After a template plugin generates a package, patch workspace configs:
 * 1. Package tsconfig.json — set extends to workspace tsconfig.base.json,
 *    remove compilerOptions already covered by the base
 * 2. Workspace root tsconfig.json — add project reference
 * 3. Workspace root package.json — add to workspaces array
 */
async function postAdd(workspaceDir: string, packageDir: string, dryRun?: boolean): Promise<void> {
    const packageRelative = path.relative(workspaceDir, packageDir);

    // 1. Patch package tsconfig.json
    const pkgTsconfigPath = path.join(packageDir, 'tsconfig.json');
    const baseTsconfigPath = path.join(workspaceDir, 'tsconfig.base.json');

    if (await fs.pathExists(pkgTsconfigPath) && await fs.pathExists(baseTsconfigPath)) {
        const extendsPath = path.relative(packageDir, baseTsconfigPath).replace(/\\/g, '/');
        const baseTsconfig = JSON.parse(
            (await fs.readFile(baseTsconfigPath, 'utf-8')).replace(/\/\/.*$/gm, '')
        );
        const baseKeys = new Set(Object.keys(baseTsconfig.compilerOptions ?? {}));

        const pkgTsconfig = JSON.parse(
            (await fs.readFile(pkgTsconfigPath, 'utf-8')).replace(/\/\/.*$/gm, '')
        );

        // Set extends
        pkgTsconfig.extends = extendsPath;

        // Strip compilerOptions already in base
        if (pkgTsconfig.compilerOptions) {
            for (const key of baseKeys) {
                delete pkgTsconfig.compilerOptions[key];
            }
            if (Object.keys(pkgTsconfig.compilerOptions).length === 0) {
                delete pkgTsconfig.compilerOptions;
            }
        }

        if (dryRun) {
            console.log(`[dry-run] Would patch ${pkgTsconfigPath}`);
            console.log(JSON.stringify(pkgTsconfig, null, 2));
        } else {
            await fs.writeJson(pkgTsconfigPath, pkgTsconfig, { spaces: 2 });
            console.log(`Patched: ${pkgTsconfigPath}`);
        }
    }

    // 2. Add project reference to workspace tsconfig.json
    const wsTsconfigPath = path.join(workspaceDir, 'tsconfig.json');
    if (await fs.pathExists(wsTsconfigPath)) {
        const wsTsconfig = JSON.parse(
            (await fs.readFile(wsTsconfigPath, 'utf-8')).replace(/\/\/.*$/gm, '')
        );
        const refPath = packageRelative.replace(/\\/g, '/');

        if (!wsTsconfig.references) wsTsconfig.references = [];
        const alreadyReferenced = wsTsconfig.references.some(
            (ref: { path: string }) => ref.path === refPath
        );
        if (!alreadyReferenced) {
            wsTsconfig.references.push({ path: refPath });

            if (dryRun) {
                console.log(`[dry-run] Would add reference "${refPath}" to ${wsTsconfigPath}`);
            } else {
                await fs.writeJson(wsTsconfigPath, wsTsconfig, { spaces: 2 });
                console.log(`Added reference "${refPath}" to ${wsTsconfigPath}`);
            }
        }
    }

    // 3. Add to workspace package.json workspaces array
    const wsPkgPath = path.join(workspaceDir, 'package.json');
    const wsPkg = await fs.readJson(wsPkgPath);
    const wsEntry = packageRelative.replace(/\\/g, '/');

    if (!wsPkg.workspaces.includes(wsEntry)) {
        wsPkg.workspaces.push(wsEntry);

        if (dryRun) {
            console.log(`[dry-run] Would add "${wsEntry}" to workspaces in ${wsPkgPath}`);
        } else {
            await fs.writeJson(wsPkgPath, wsPkg, { spaces: 4 });
            console.log(`Added "${wsEntry}" to workspaces in ${wsPkgPath}`);
        }
    }
}

const TEMPLATES: Record<string, string> = {
    'ts-lib': 'libria:scaffold:ts-lib',
    'angular': 'libria:scaffold:angular',
};

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
                                  description: 'Workspace to use:'
                                },
                                template: {
                                    flags: '--template <template>',
                                    description: 'Template to use:',
                                    choices: Object.keys(TEMPLATES)
                                },
                            };

                            // Once template is chosen, delegate to that plugin's getOptions
                            const templateKey = (opts as Record<string, unknown>).template as string | undefined;
                            if (templateKey && TEMPLATES[templateKey]) {
                                const templatePlugin = ctx.getPlugin<ScaffoldTemplatePlugin>(TEMPLATES[templateKey]);
                                const templateOpts = await templatePlugin.getOptions(opts);
                                return { ...addBase, ...templateOpts };
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
                        case 'add': {
                            const addOpts = opts as ExecuteOptions<AddOptions>;
                            const workspaceDir = path.resolve(process.cwd(), addOpts.workspace);

                            // Verify the workspace path is valid
                            const pkgPath = path.join(workspaceDir, 'package.json');
                            if (await fs.pathExists(pkgPath)) {
                                const pkg = await fs.readJson(pkgPath);
                                if (!pkg.workspaces) {
                                    console.error(`"${addOpts.workspace}" has a package.json but no "workspaces" field.`);
                                    process.exit(1);
                                }
                            } else {
                                console.error(`No package.json found in "${addOpts.workspace}". Is this a workspace?`);
                                process.exit(1);
                            }

                            const pluginId = TEMPLATES[addOpts.template];
                            if (!pluginId) {
                                console.error(`Unknown template: ${addOpts.template}`);
                                process.exit(1);
                            }

                            const packageDir = path.resolve(process.cwd(), addOpts.workspace, 'packages', addOpts.name);

                            const templatePlugin = ctx.getPlugin<ScaffoldTemplatePlugin>(pluginId);
                            await templatePlugin.execute({
                                ...opts,
                                name: path.join(addOpts.workspace, 'packages', addOpts.name),
                                gitInit: false,
                                install: false,
                            });

                            await postAdd(workspaceDir, packageDir, addOpts.dryRun);
                            break;
                        }
                    }
                },
            },
        };
    },
});
