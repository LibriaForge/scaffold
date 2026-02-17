import { InteractiveCommand } from 'interactive-commander';

import {
    addPackage,
    addPluginGlob,
    findConfigPath,
    GLOBAL_CONFIG_PATH,
    initConfig,
    listPackages,
    listPluginGlobs,
    loadConfig,
    loadRawConfig,
    removePackage,
    removePluginGlob,
} from '../config';
import { resolvePackageDir } from '../utils';
import { PluginManager, PluginMetadata } from '@libria/plugin-loader';
import { glob } from 'fast-glob';

async function assertCanRemovePlugins(
    pluginManager: PluginManager,
    pattern: string
): Promise<void> {
    const metadataToRemove = await pluginManager.discoverPlugins(pattern);
    const allMetadata = pluginManager.getAllMetadata();

    const toRemoveSet = new Set(metadataToRemove.map(m => m.id));

    // Check all loaded plugins to see if they depend on any plugin in the removal set
    const blockingPlugins = allMetadata
        .filter(p => !toRemoveSet.has(p.id)) // ignore plugins that are themselves being removed
        .map(p => {
            const blockedDeps = p.dependencies?.filter(d => toRemoveSet.has(d.id)) ?? [];
            return { plugin: p, blockedDeps };
        })
        .filter(x => x.blockedDeps.length > 0);

    if (blockingPlugins.length > 0) {
        // format the message
        const message = [
            `Cannot remove plugins matching pattern "${pattern}" because other plugins depend on them:`,
            ...blockingPlugins.map(
                bp =>
                    `- Plugin "${bp.plugin.id}" depends on: ${bp.blockedDeps.map(d => d.id).join(', ')}`
            ),
        ].join('\n');

        throw new Error(message);
    }
}

async function assertCanAddPlugins(pluginManager: PluginManager, pattern: string) {
    // discover all plugins that would be added by this glob
    const metadataToAdd = await pluginManager.discoverPlugins(pattern);

    // all currently loaded plugins
    const allMetadata = pluginManager.getAllMetadata();
    const allLoadedOrToAdd = new Map<string, PluginMetadata>();
    allMetadata.forEach(p => allLoadedOrToAdd.set(p.id, p));
    metadataToAdd.forEach(p => allLoadedOrToAdd.set(p.id, p)); // include plugins that will be added

    // check dependencies for each plugin we're about to add
    const missingDeps: { plugin: PluginMetadata; missing: string[] }[] = [];

    for (const plugin of metadataToAdd) {
        const deps = plugin.dependencies?.map(d => d.id) ?? [];
        const missing = deps.filter(depId => !allLoadedOrToAdd.has(depId));
        if (missing.length > 0) {
            missingDeps.push({ plugin, missing });
        }
    }

    if (missingDeps.length > 0) {
        const message = [
            `Cannot add plugins matching pattern "${pattern}" because dependencies are missing:`,
            ...missingDeps.map(
                md => `- Plugin "${md.plugin.id}" is missing dependencies: ${md.missing.join(', ')}`
            ),
        ].join('\n');
        throw new Error(message);
    }
}

function resolveConfigPath(opts: { global?: boolean }): string | undefined {
    return opts.global ? GLOBAL_CONFIG_PATH : undefined;
}

export async function registerConfigCommand(
    program: InteractiveCommand,
    pluginManager: PluginManager
): Promise<InteractiveCommand> {
    const configCommand = program.command('config').description('Manage lb-scaffold configuration');

    configCommand
        .command('init')
        .description('Initialize a new .lbscaffold.json config file')
        .option('-g, --global', 'Target the global config (~/.lbscaffold.json)')
        .action(async (opts: { global?: boolean }) => {
            try {
                const configPath = await initConfig(resolveConfigPath(opts));
                console.log(`Created config file: ${configPath}`);
            } catch (error) {
                console.error((error as Error).message);
                process.exit(1);
            }
        });

    configCommand
        .command('add <glob>')
        .description('Add a plugin glob pattern to the config')
        .option('-g, --global', 'Target the global config (~/.lbscaffold.json)')
        .action(async (glob: string, opts: { global?: boolean }) => {
            try {
                await assertCanAddPlugins(pluginManager, glob);
                await addPluginGlob(glob, resolveConfigPath(opts));
                console.log(`Added plugin pattern: ${glob}`);
            } catch (error) {
                console.error((error as Error).message);
                process.exit(1);
            }
        });

    configCommand
        .command('remove <glob>')
        .description('Remove a plugin glob pattern from the config')
        .option('-g, --global', 'Target the global config (~/.lbscaffold.json)')
        .action(async (glob: string, opts: { global?: boolean }) => {
            try {
                await assertCanRemovePlugins(pluginManager, glob);
                await removePluginGlob(glob, resolveConfigPath(opts));
                console.log(`Removed plugin pattern: ${glob}`);
            } catch (error) {
                console.error((error as Error).message);
                process.exit(1);
            }
        });

    configCommand
        .command('list')
        .description('List all plugin patterns and packages in the config')
        .option('-g, --global', 'Show only the global config (~/.lbscaffold.json)')
        .action(async (opts: { global?: boolean }) => {
            if (opts.global) {
                console.log(`Global config: ${GLOBAL_CONFIG_PATH}\n`);
                const globalConfig = await loadRawConfig(GLOBAL_CONFIG_PATH);

                const globs = globalConfig.plugins ?? [];
                if (globs.length === 0) {
                    console.log('No plugin patterns configured.');
                } else {
                    console.log('Plugin patterns:');
                    for (const g of globs) {
                        console.log(`  - ${g}`);
                    }
                }

                const packages = globalConfig.packages ?? [];
                if (packages.length > 0) {
                    console.log('\nPackages:');
                    for (const pkg of packages) {
                        console.log(`  - ${pkg}`);
                    }
                }
                return;
            }

            // Show merged config with source indicators
            const globalConfig = await loadRawConfig(GLOBAL_CONFIG_PATH);
            const localPath = await findConfigPath();
            const localConfig = localPath ? await loadRawConfig(localPath) : {};
            const hasGlobal = Object.keys(globalConfig).length > 0;
            const hasLocal = localPath !== null;

            if (!hasGlobal && !hasLocal) {
                console.log('No config files found.');
                console.log('Run "lb-scaffold config init" to create a local config.');
                console.log('Run "lb-scaffold config init -g" to create a global config.');
                return;
            }

            if (hasGlobal) console.log(`Global config: ${GLOBAL_CONFIG_PATH}`);
            if (hasLocal) console.log(`Local config:  ${localPath}`);
            console.log();

            const merged = await loadConfig();
            const pluginSource = localConfig.plugins ? 'local' : hasGlobal && globalConfig.plugins ? 'global' : null;
            const globs = merged.plugins ?? [];
            if (globs.length === 0) {
                console.log('No plugin patterns configured.');
            } else {
                console.log(`Plugin patterns (source: ${pluginSource}):`);
                for (const g of globs) {
                    console.log(`  - ${g}`);
                }
            }

            const packageSource = localConfig.packages ? 'local' : hasGlobal && globalConfig.packages ? 'global' : null;
            const packages = merged.packages ?? [];
            if (packages.length > 0) {
                console.log(`\nPackages (source: ${packageSource}):`);
                for (const pkg of packages) {
                    console.log(`  - ${pkg}`);
                }
            }
        });

    configCommand
        .command('show')
        .description('Show the full config file contents')
        .option('-g, --global', 'Show only the global config (~/.lbscaffold.json)')
        .action(async (opts: { global?: boolean }) => {
            if (opts.global) {
                console.log(`Global config: ${GLOBAL_CONFIG_PATH}\n`);
                const config = await loadRawConfig(GLOBAL_CONFIG_PATH);
                console.log(JSON.stringify(config, null, 2));
                return;
            }

            // Show merged config
            const globalConfig = await loadRawConfig(GLOBAL_CONFIG_PATH);
            const localPath = await findConfigPath();
            const hasGlobal = Object.keys(globalConfig).length > 0;

            if (!hasGlobal && !localPath) {
                console.log('No config files found.');
                console.log('Run "lb-scaffold config init" to create a local config.');
                console.log('Run "lb-scaffold config init -g" to create a global config.');
                return;
            }

            if (hasGlobal) console.log(`Global config: ${GLOBAL_CONFIG_PATH}`);
            if (localPath) console.log(`Local config:  ${localPath}`);
            console.log();

            const merged = await loadConfig();
            console.log(JSON.stringify(merged, null, 2));
        });

    configCommand
        .command('add-package <name>')
        .description('Add an npm package as a plugin source')
        .option('-g, --global', 'Target the global config (~/.lbscaffold.json)')
        .action(async (name: string, opts: { global?: boolean }) => {
            try {
                await assertCanAddPlugins(pluginManager, await resolvePackageDir(name));
                await addPackage(name, resolveConfigPath(opts));
                console.log(`Added package: ${name}`);
            } catch (error) {
                console.error((error as Error).message);
                process.exit(1);
            }
        });

    configCommand
        .command('remove-package <name>')
        .description('Remove an npm package from plugin sources')
        .option('-g, --global', 'Target the global config (~/.lbscaffold.json)')
        .action(async (name: string, opts: { global?: boolean }) => {
            try {
                await assertCanRemovePlugins(pluginManager, await resolvePackageDir(name));
                await removePackage(name, resolveConfigPath(opts));
                console.log(`Removed package: ${name}`);
            } catch (error) {
                console.error((error as Error).message);
                process.exit(1);
            }
        });

    configCommand
        .command('list-packages')
        .description('List all npm packages configured as plugin sources')
        .option('-g, --global', 'Show only packages from the global config (~/.lbscaffold.json)')
        .action(async (opts: { global?: boolean }) => {
            if (opts.global) {
                const globalConfig = await loadRawConfig(GLOBAL_CONFIG_PATH);
                const packages = globalConfig.packages ?? [];
                if (packages.length === 0) {
                    console.log('No packages configured in global config.');
                } else {
                    console.log('Packages (global):');
                    for (const pkg of packages) {
                        console.log(`  - ${pkg}`);
                    }
                }
                return;
            }

            const packages = await listPackages();
            if (packages.length === 0) {
                console.log('No packages configured.');
            } else {
                console.log('Packages:');
                for (const pkg of packages) {
                    console.log(`  - ${pkg}`);
                }
            }
        });

    return configCommand;
}
